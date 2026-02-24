import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSunday } from "date-fns";

const db = new Database("scanning.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    target_files INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    site_id INTEGER,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (site_id) REFERENCES sites(id)
  );

  CREATE TABLE IF NOT EXISTS scanning_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    date TEXT NOT NULL,
    files INTEGER DEFAULT 0,
    pages INTEGER DEFAULT 0,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    UNIQUE(employee_id, date)
  );

  CREATE TABLE IF NOT EXISTS admin_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    username TEXT NOT NULL,
    password TEXT NOT NULL
  );
`);

// Seed default admin if not exists
const adminCount = db.prepare("SELECT COUNT(*) as count FROM admin_settings").get() as { count: number };
if (adminCount.count === 0) {
  db.prepare("INSERT INTO admin_settings (id, username, password) VALUES (1, ?, ?)").run('admin', 'password');
}

// Migration: Add is_active to employees if not exists
try {
  db.prepare("SELECT is_active FROM employees LIMIT 1").get();
} catch (e) {
  console.log("Migrating: Adding is_active column to employees table");
  db.exec("ALTER TABLE employees ADD COLUMN is_active INTEGER DEFAULT 1");
}

// Seed initial data if empty
const siteCount = db.prepare("SELECT COUNT(*) as count FROM sites").get() as { count: number };
if (siteCount.count === 0) {
  const insertSite = db.prepare("INSERT INTO sites (name, target_files) VALUES (?, ?)");
  const insertEmployee = db.prepare("INSERT INTO employees (name, site_id) VALUES (?, ?)");
  
  const multanId = insertSite.run("Multan", 100000).lastInsertRowid;
  const lahoreId = insertSite.run("Lahore", 150000).lastInsertRowid;
  const karachiId = insertSite.run("Karachi", 200000).lastInsertRowid;

  ["Ali", "Sara", "Ahmed"].forEach(name => insertEmployee.run(name, multanId));
  ["Zain", "Hina"].forEach(name => insertEmployee.run(name, lahoreId));
  ["Omar", "Fatima", "Bilal"].forEach(name => insertEmployee.run(name, karachiId));
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const admin = db.prepare("SELECT * FROM admin_settings WHERE username = ? AND password = ?").get(username, password);
    if (admin) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: "Invalid credentials" });
    }
  });

  app.post("/api/change-password", (req, res) => {
    const { username, oldPassword, newPassword } = req.body;
    const admin = db.prepare("SELECT * FROM admin_settings WHERE username = ? AND password = ?").get(username, oldPassword);
    if (admin) {
      db.prepare("UPDATE admin_settings SET password = ? WHERE id = 1").run(newPassword);
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: "Invalid old password" });
    }
  });

  app.get("/api/sites", (req, res) => {
    const sites = db.prepare("SELECT * FROM sites").all();
    res.json(sites);
  });

  app.get("/api/sites/:id/employees", (req, res) => {
    const employees = db.prepare("SELECT * FROM employees WHERE site_id = ?").all(req.params.id);
    res.json(employees);
  });

  app.get("/api/scanning-data", (req, res) => {
    const { siteId, date } = req.query;
    const data = db.prepare(`
      SELECT e.id as employee_id, e.name, e.is_active, sd.files, sd.pages, sd.date
      FROM employees e
      LEFT JOIN scanning_data sd ON e.id = sd.employee_id AND sd.date = ?
      WHERE e.site_id = ? AND (e.is_active = 1 OR sd.employee_id IS NOT NULL)
    `).all(date, siteId);
    res.json(data);
  });

  app.post("/api/scanning-data", (req, res) => {
    const { employee_id, date, files, pages } = req.body;
    const upsert = db.prepare(`
      INSERT INTO scanning_data (employee_id, date, files, pages)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(employee_id, date) DO UPDATE SET
        files = excluded.files,
        pages = excluded.pages
    `);
    upsert.run(employee_id, date, files, pages);
    res.json({ success: true });
  });

  app.get("/api/stats/:siteId", (req, res) => {
    const siteId = req.params.siteId;
    
    const overall = db.prepare(`
      SELECT 
        SUM(sd.files) as total_files, 
        SUM(sd.pages) as total_pages,
        s.target_files
      FROM sites s
      LEFT JOIN employees e ON s.id = e.site_id
      LEFT JOIN scanning_data sd ON e.id = sd.employee_id
      WHERE s.id = ?
    `).get(siteId) as any;

    const monthly = db.prepare(`
      SELECT 
        strftime('%Y-%m', date) as month,
        SUM(files) as files,
        SUM(pages) as pages
      FROM scanning_data sd
      JOIN employees e ON sd.employee_id = e.id
      WHERE e.site_id = ?
      GROUP BY month
      ORDER BY month DESC
    `).all(siteId);

    const weekly = db.prepare(`
      SELECT 
        date,
        SUM(files) as files,
        SUM(pages) as pages
      FROM scanning_data sd
      JOIN employees e ON sd.employee_id = e.id
      WHERE e.site_id = ?
      GROUP BY date
      ORDER BY date DESC
      LIMIT 30
    `).all(siteId);

    res.json({ overall, monthly, weekly });
  });

  app.get("/api/export/:siteId", (req, res) => {
    const siteId = req.params.siteId;
    const monthStr = req.query.month as string || format(new Date(), 'yyyy-MM');
    
    const site = db.prepare("SELECT * FROM sites WHERE id = ?").get(siteId) as any;
    if (!site) return res.status(404).json({ error: "Site not found" });

    const employees = db.prepare("SELECT * FROM employees WHERE site_id = ?").all(siteId) as any[];
    const startDate = startOfMonth(parseISO(monthStr + "-01"));
    const endDate = endOfMonth(startDate);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const scanningData = db.prepare(`
      SELECT sd.*, e.name as employee_name
      FROM scanning_data sd
      JOIN employees e ON sd.employee_id = e.id
      WHERE e.site_id = ? AND sd.date LIKE ?
    `).all(siteId, `${monthStr}%`) as any[];

    // Build the grid
    const aoa: any[][] = [];

    // Summary Table at the top
    aoa.push(["NAME", "FILES", "PAGES"]);
    let grandTotalFiles = 0;
    let grandTotalPages = 0;
    employees.forEach(e => {
      const eFiles = scanningData.filter(d => d.employee_id === e.id).reduce((sum, d) => sum + d.files, 0);
      const ePages = scanningData.filter(d => d.employee_id === e.id).reduce((sum, d) => sum + d.pages, 0);
      aoa.push([e.name, eFiles, ePages]);
      grandTotalFiles += eFiles;
      grandTotalPages += ePages;
    });
    aoa.push(["TOTAL", grandTotalFiles, grandTotalPages]);
    aoa.push([]); // Spacer
    aoa.push([]); // Spacer
    
    // Row 1: Title
    const titleRow: any[] = Array(3 + employees.length * 2).fill("");
    titleRow[1] = `${format(startDate, 'MMMM').toUpperCase()} SCANNING`;
    aoa.push(titleRow);

    // Row 2: Operator Names
    const nameRow: any[] = ["", "", ""];
    employees.forEach(e => {
      nameRow.push(e.name.toUpperCase(), "");
    });
    aoa.push(nameRow);

    // Row 3: Total Files per operator
    const totalFilesRow: any[] = ["", "", ""];
    employees.forEach(e => {
      const total = scanningData.filter(d => d.employee_id === e.id).reduce((sum, d) => sum + d.files, 0);
      totalFilesRow.push("TOTAL FILES", total);
    });
    aoa.push(totalFilesRow);

    // Row 4: Total Pages per operator
    const totalPagesRow: any[] = ["", "", ""];
    employees.forEach(e => {
      const total = scanningData.filter(d => d.employee_id === e.id).reduce((sum, d) => sum + d.pages, 0);
      totalPagesRow.push("TOTAL PAGES", total);
    });
    aoa.push(totalPagesRow);

    // Row 5: Headers
    const headerRow: any[] = ["DATE", "TOTAL FILES", "TOTAL PAGES"];
    employees.forEach(() => {
      headerRow.push("FILES", "PAGES");
    });
    aoa.push(headerRow);

    // Rows 6+: Daily Data
    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const row = [format(day, 'M/d/yy')];
      
      const dayData = scanningData.filter(d => d.date === dateStr);
      const totalFiles = dayData.reduce((sum, d) => sum + d.files, 0);
      const totalPages = dayData.reduce((sum, d) => sum + d.pages, 0);
      
      row.push(totalFiles || 0, totalPages || 0);

      if (isSunday(day)) {
        employees.forEach(() => {
          row.push("SUNDAY", "SUNDAY");
        });
      } else {
        employees.forEach(e => {
          const empData = dayData.find(d => d.employee_id === e.id);
          row.push(empData?.files || 0, empData?.pages || 0);
        });
      }
      aoa.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    
    // Add some basic merging for headers
    const summaryRows = employees.length + 4; // 1 header + N employees + 1 total + 2 spacers
    const merges = [
      { s: { r: summaryRows, c: 1 }, e: { r: summaryRows, c: 2 } } // Title merge
    ];
    employees.forEach((_, i) => {
      const colStart = 3 + i * 2;
      merges.push({ s: { r: summaryRows + 1, c: colStart }, e: { r: summaryRows + 1, c: colStart + 1 } }); // Name merge
    });
    ws['!merges'] = merges;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Scanning Data");
    
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", `attachment; filename=${monthStr}_scanning_report.xlsx`);
    res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buf);
  });

  app.delete("/api/sites/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare(`
        DELETE FROM scanning_data 
        WHERE employee_id IN (SELECT id FROM employees WHERE site_id = ?)
      `).run(id);
      db.prepare("DELETE FROM employees WHERE site_id = ?").run(id);
      db.prepare("DELETE FROM sites WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Site delete error:", error);
      res.status(500).json({ error: "Failed to delete site" });
    }
  });

  app.patch("/api/sites/:id", (req, res) => {
    const { target_files } = req.body;
    db.prepare("UPDATE sites SET target_files = ? WHERE id = ?").run(target_files, req.params.id);
    res.json({ success: true });
  });

  app.post("/api/sites", (req, res) => {
    const { name, target_files } = req.body;
    const insert = db.prepare("INSERT INTO sites (name, target_files) VALUES (?, ?)");
    const result = insert.run(name, target_files || 0);
    res.json({ id: result.lastInsertRowid, name, target_files });
  });

  app.post("/api/employees", (req, res) => {
    const { name, site_id } = req.body;
    const insert = db.prepare("INSERT INTO employees (name, site_id) VALUES (?, ?)");
    const result = insert.run(name, site_id);
    res.json({ id: result.lastInsertRowid, name, site_id });
  });

  app.delete("/api/employees/:id", (req, res) => {
    const { id } = req.params;
    console.log(`Deactivating employee ${id}`);
    try {
      db.prepare("UPDATE employees SET is_active = 0 WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Deactivation error:", error);
      res.status(500).json({ error: "Failed to deactivate employee" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
