import express from "express";
import session from "express-session";
import { createServer as createViteServer } from "vite";

declare module 'express-session' {
  interface SessionData {
    user: {
      id: number;
      username: string;
      role: string;
      permissions: string[];
    };
  }
}

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSunday } from "date-fns";
import bcrypt from "bcryptjs";
import { Site, Employee, ScanningData, Stats } from './src/types';

const db = new Database("scanning.db");
db.prepare("PRAGMA journal_mode=WAL").run();

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

  CREATE TABLE IF NOT EXISTS daily_extra_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER,
    date TEXT NOT NULL,
    extra_pages INTEGER DEFAULT 0,
    FOREIGN KEY (site_id) REFERENCES sites(id),
    UNIQUE(site_id, date)
  );

  CREATE TABLE IF NOT EXISTS admin_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    username TEXT NOT NULL,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    permissions TEXT DEFAULT '[]',
    site_access TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS user_tokens (
    token TEXT PRIMARY KEY,
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Seed default admin if not exists
const adminUser = db.prepare("SELECT * FROM users WHERE username = 'admin'").get() as any;
if (!adminUser) {
  const hashedPassword = bcrypt.hashSync('password', 10);
  db.prepare("INSERT INTO users (username, password, role, permissions, site_access) VALUES (?, ?, ?, ?, ?)").run('admin', hashedPassword, 'admin', '["main-view", "personal-records", "admin-data-entry", "admin-management", "admin-reports", "admin-sites", "admin-operators", "admin-users"]', '[]');
}

// Migration: Add site_access to users if not exists
try {
  db.prepare("ALTER TABLE users ADD COLUMN site_access TEXT DEFAULT '[]'").run();
} catch (e) {
  // Column already exists
}

// Migration: Add rate_per_page to employees if not exists
try {
  db.prepare("ALTER TABLE employees ADD COLUMN rate_per_page REAL DEFAULT 0.30").run();
} catch (e) {
  // Column already exists
}

// Migration: Add employee_id to users if not exists
try {
  db.prepare("ALTER TABLE users ADD COLUMN employee_id INTEGER").run();
} catch (e) {
  // Column already exists
}

// Migration: Hash any remaining plain text passwords
const allUsers = db.prepare("SELECT * FROM users").all() as any[];
for (const user of allUsers) {
  if (user.password && !user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
    console.log(`Migrating: Hashing plain text password for user: ${user.username}`);
    const hashedPassword = bcrypt.hashSync(user.password, 10);
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, user.id);
  }
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

// Helper for deterministic random split
function getDeterministicSplit(totalExtra: number, employeeId: number, allActiveEmployeeIds: number[], dateStr: string) {
  if (allActiveEmployeeIds.length === 0) return 0;
  if (allActiveEmployeeIds.length === 1) return allActiveEmployeeIds[0] === employeeId ? totalExtra : 0;

  const count = allActiveEmployeeIds.length;
  const sortedIds = [...allActiveEmployeeIds].sort((a, b) => a - b);
  const base = Math.floor(totalExtra / count);
  
  let remaining = totalExtra;
  const results: Record<number, number> = {};

  for (let i = 0; i < count; i++) {
    const id = sortedIds[i];
    if (i === count - 1) {
      results[id] = remaining;
    } else {
      // Create a seed based on date and employee ID
      const seedStr = `${dateStr}-${id}`;
      let hash = 0;
      for (let j = 0; j < seedStr.length; j++) {
        hash = ((hash << 5) - hash) + seedStr.charCodeAt(j);
        hash |= 0;
      }
      const hashAbs = Math.abs(hash);
      
      // Random offset between -50 and 50
      // Limit offset so we don't get negative numbers or exceed remaining
      const maxPossibleOffset = Math.min(50, base);
      const minPossibleOffset = -Math.min(50, base);
      const offset = (hashAbs % (maxPossibleOffset - minPossibleOffset + 1)) + minPossibleOffset;
      
      let amount = base + offset;
      if (amount < 0) amount = 0;
      if (amount > remaining) amount = remaining;
      
      results[id] = amount;
      remaining -= amount;
    }
  }

  return results[employeeId] || 0;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.set('trust proxy', true);
  app.use(session({
    secret: process.env.SESSION_SECRET || 'scanning-secret-key',
    resave: true,
    saveUninitialized: false,
    rolling: true,
    name: 'scantrack.sid',
    cookie: { 
      secure: true, 
      sameSite: 'none',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Auth Middleware
  const requireAuth = (req: any, res: any, next: any) => {
    const token = req.headers['x-auth-token'] || req.query.token;
    
    if (token && typeof token === 'string' && token.length > 0) {
      try {
        const tokenData = db.prepare(`
          SELECT u.* FROM users u 
          JOIN user_tokens ut ON u.id = ut.user_id 
          WHERE ut.token = ?
        `).get(token) as any;
        
        if (tokenData) {
          req.user = {
            id: tokenData.id,
            username: tokenData.username,
            role: tokenData.role,
            employee_id: tokenData.employee_id,
            permissions: typeof tokenData.permissions === 'string' ? JSON.parse(tokenData.permissions || '[]') : (tokenData.permissions || []),
            site_access: typeof tokenData.site_access === 'string' ? JSON.parse(tokenData.site_access || '[]') : (tokenData.site_access || [])
          };
          console.log(`[AUTH] Authorized via token: ${tokenData.username}`);
          return next();
        } else {
          console.log(`[AUTH] Invalid token provided: ${token.substring(0, 5)}...`);
        }
      } catch (err) {
        console.error('[AUTH] Token lookup error:', err);
      }
    }

    if (req.session && req.session.user) {
      req.user = req.session.user;
      console.log(`[AUTH] Authorized via session: ${req.user.username}`);
      return next();
    }
    
    console.log(`[AUTH] Unauthorized access attempt to ${req.url}. Token: ${!!token}, Session: ${!!req.session?.user}`);
    res.status(401).json({ error: "Unauthorized" });
  };

  const checkSiteAccess = (user: any, siteId: number | string, permission?: string) => {
    if (user.role === 'admin') return true;
    
    // Check global permission first
    if (permission && !user.permissions?.includes(permission)) return false;
    
    // Check site access
    const accessibleSites = Array.isArray(user.site_access) ? user.site_access.map(Number) : [];
    if (!accessibleSites.includes(Number(siteId))) return false;
    
    return true;
  };

  // Auth Routes
  app.post("/api/login", (req: any, res: any) => {
    try {
      const { username, password } = req.body;
      
      // Clear any existing session first to ensure a clean start
      if (req.session) {
        req.session.user = null;
      }

      if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: "Username and password required" });
      }

      console.log(`[AUTH] Login attempt for user: ${username}`);
      const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
      
      if (user && bcrypt.compareSync(password, user.password)) {
        console.log(`[AUTH] User found: ${username}, role: ${user.role}`);
        const userData = {
          id: user.id,
          username: user.username,
          role: user.role,
          employee_id: user.employee_id,
          permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions || '[]') : (user.permissions || []),
          site_access: typeof user.site_access === 'string' ? JSON.parse(user.site_access || '[]') : (user.site_access || [])
        };

        // Generate token
        const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
        console.log(`[AUTH] Generating token for ${username}`);
        db.prepare("INSERT INTO user_tokens (token, user_id) VALUES (?, ?)").run(token, user.id);

        // Regenerate session to prevent fixation and ensure fresh state
        req.session.regenerate((err: any) => {
          if (err) console.error('[AUTH] Session regeneration error:', err);
          
          req.session.user = userData;
          req.session.save((err: any) => {
            if (err) console.error('[AUTH] Session save error:', err);
            console.log(`[AUTH] Login successful for ${username}. New SessionID: ${req.sessionID}`);
            res.json({ success: true, user: userData, token });
          });
        });
      } else {
        console.log(`[AUTH] Login failed for ${username}`);
        res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (err) {
      console.error('[AUTH] Login error:', err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/me", (req: any, res: any) => {
    try {
      const token = req.headers['x-auth-token'] || req.query.token;
      
      if (token && typeof token === 'string' && token.length > 0) {
        const tokenData = db.prepare(`
          SELECT u.* FROM users u 
          JOIN user_tokens ut ON u.id = ut.user_id 
          WHERE ut.token = ?
        `).get(token) as any;
        
        if (tokenData) {
          const userData = {
            id: tokenData.id,
            username: tokenData.username,
            role: tokenData.role,
            employee_id: tokenData.employee_id,
            permissions: typeof tokenData.permissions === 'string' ? JSON.parse(tokenData.permissions || '[]') : (tokenData.permissions || []),
            site_access: typeof tokenData.site_access === 'string' ? JSON.parse(tokenData.site_access || '[]') : (tokenData.site_access || [])
          };
          console.log(`[AUTH] /api/me found user via token: ${userData.username}`);
          return res.json(userData);
        } else {
          console.log(`[AUTH] /api/me token lookup failed for token starting with: ${token.substring(0, 5)}`);
        }
      }
      
      if (req.session && req.session.user) {
        // Refresh user data from DB to ensure it's up to date
        const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.user.id) as any;
        if (user) {
          const userData = {
            id: user.id,
            username: user.username,
            role: user.role,
            employee_id: user.employee_id,
            permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions || '[]') : (user.permissions || []),
            site_access: typeof user.site_access === 'string' ? JSON.parse(user.site_access || '[]') : (user.site_access || [])
          };
          req.session.user = userData; // Update session
          console.log(`[AUTH] /api/me found user via session: ${userData.username}`);
          return res.json(userData);
        } else {
          console.log(`[AUTH] /api/me session user ID ${req.session.user.id} not found in DB`);
        }
      }
      
      console.log('[AUTH] /api/me no user found (no valid token or session)');
      res.json(null);
    } catch (err) {
      console.error('[API] /api/me error:', err);
      res.status(500).json(null);
    }
  });

  app.post("/api/logout", (req, res) => {
    const token = req.headers['x-auth-token'] || req.query.token;
    if (token) {
      db.prepare("DELETE FROM user_tokens WHERE token = ?").run(token);
    }
    req.session.destroy((err) => {
      res.clearCookie('scantrack.sid', {
        path: '/',
        secure: true,
        sameSite: 'none',
        httpOnly: true
      });
      res.json({ success: true });
    });
  });

  app.post("/api/update-profile", requireAuth, (req: any, res: any) => {
    const { username, currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    
    // If changing password, verify current password
    if (newPassword) {
      if (!currentPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters" });
      }

      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
      if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
        return res.status(400).json({ error: "Current password incorrect" });
      }
      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, userId);
    }

    // If changing username
    if (username && username !== req.user.username) {
      if (typeof username !== 'string' || username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: "Username must be between 3 and 20 characters" });
      }
      try {
        db.prepare("UPDATE users SET username = ? WHERE id = ?").run(username, userId);
      } catch (err) {
        return res.status(400).json({ error: "Username already exists" });
      }
    }
    
    res.json({ success: true });
  });

  // User Management Routes
  app.get("/api/users", requireAuth, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const users = db.prepare("SELECT id, username, role, permissions, site_access, employee_id FROM users").all();
    res.json(users.map((u: any) => ({ 
      ...u, 
      permissions: typeof u.permissions === 'string' ? JSON.parse(u.permissions || '[]') : (u.permissions || []),
      site_access: typeof u.site_access === 'string' ? JSON.parse(u.site_access || '[]') : (u.site_access || []),
      employee_id: u.employee_id
    })));
  });

  app.post("/api/users", requireAuth, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { username, password, role, permissions, site_access, employee_id } = req.body;
    
    if (!username || !password || typeof username !== 'string' || username.length < 3) {
      return res.status(400).json({ error: "Invalid username or password" });
    }

    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      db.prepare("INSERT INTO users (username, password, role, permissions, site_access, employee_id) VALUES (?, ?, ?, ?, ?, ?)").run(
        username, 
        hashedPassword, 
        role || 'user', 
        JSON.stringify(permissions || []),
        JSON.stringify(site_access || []),
        employee_id || null
      );
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Username already exists" });
    }
  });

  app.put("/api/users/:id", requireAuth, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { username, password, role, permissions, site_access, employee_id } = req.body;
    
    if (!username || typeof username !== 'string' || username.length < 3) {
      return res.status(400).json({ error: "Invalid username" });
    }

    if (password) {
      const hashedPassword = bcrypt.hashSync(password, 10);
      db.prepare("UPDATE users SET username = ?, password = ?, role = ?, permissions = ?, site_access = ?, employee_id = ? WHERE id = ?").run(
        username, hashedPassword, role, JSON.stringify(permissions), JSON.stringify(site_access), employee_id || null, req.params.id
      );
    } else {
      db.prepare("UPDATE users SET username = ?, role = ?, permissions = ?, site_access = ?, employee_id = ? WHERE id = ?").run(
        username, role, JSON.stringify(permissions), JSON.stringify(site_access), employee_id || null, req.params.id
      );
    }
    res.json({ success: true });
  });

  app.delete("/api/users/:id", requireAuth, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: "Cannot delete yourself" });
    db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // API Routes
  app.get("/api/sites", requireAuth, (req: any, res) => {
    const sites = db.prepare("SELECT * FROM sites").all() as Site[];
    if (req.user.role === 'admin') {
      return res.json(sites);
    }
    const access = Array.isArray(req.user.site_access) ? req.user.site_access.map(Number) : [];
    const filteredSites = sites.filter(s => access.includes(Number(s.id)));
    res.json(filteredSites);
  });

  app.get("/api/sites-summary", requireAuth, (req: any, res) => {
    const sites = db.prepare("SELECT id FROM sites").all() as any[];
    const accessibleSiteIds = req.user.role === 'admin' 
      ? sites.map(s => s.id)
      : (Array.isArray(req.user.site_access) ? req.user.site_access.map(Number) : []);

    if (accessibleSiteIds.length === 0) {
      return res.json([]);
    }

    const placeholders = accessibleSiteIds.map(() => '?').join(',');
    const summary = db.prepare(`
      SELECT 
        s.id,
        s.name,
        IFNULL(SUM(sd.files), 0) as total_files,
        IFNULL(SUM(sd.pages), 0) + (SELECT IFNULL(SUM(extra_pages), 0) FROM daily_extra_pages WHERE site_id = s.id) as total_pages,
        (SELECT IFNULL(SUM(extra_pages), 0) FROM daily_extra_pages WHERE site_id = s.id) as extra_pages
      FROM sites s
      LEFT JOIN employees e ON s.id = e.site_id
      LEFT JOIN scanning_data sd ON e.id = sd.employee_id
      WHERE s.id IN (${placeholders})
      GROUP BY s.id
    `).all(...accessibleSiteIds);
    res.json(summary);
  });

  app.get("/api/operators-summary", requireAuth, (req: any, res) => {
    const { siteId, month } = req.query;
    
    if (siteId && !checkSiteAccess(req.user, siteId as string)) {
      return res.status(403).json({ error: "Access denied to this site" });
    }

    const accessibleSiteIds = req.user.role === 'admin' 
      ? null 
      : (Array.isArray(req.user.site_access) ? req.user.site_access.map(Number) : []);

    if (req.user.role !== 'admin' && (!accessibleSiteIds || accessibleSiteIds.length === 0)) {
      return res.json([]);
    }

    let query = `
      SELECT 
        e.id,
        e.name,
        s.name as site_name,
        IFNULL(SUM(sd.files), 0) as total_files,
        IFNULL(SUM(sd.pages), 0) as total_pages
      FROM employees e
      JOIN sites s ON e.site_id = s.id
      LEFT JOIN scanning_data sd ON e.id = sd.employee_id ${month ? 'AND sd.date LIKE ?' : ''}
      WHERE e.is_active = 1
    `;
    
    const params: any[] = [];
    if (month) params.push(`${month}%`);
    
    if (siteId) {
      query += ` AND e.site_id = ? `;
      params.push(siteId);
    } else if (accessibleSiteIds) {
      const placeholders = accessibleSiteIds.map(() => '?').join(',');
      query += ` AND e.site_id IN (${placeholders}) `;
      params.push(...accessibleSiteIds);
    }
    
    query += ` GROUP BY e.id `;
    
    const summary = db.prepare(query).all(...params);
    res.json(summary);
  });

  app.get("/api/sites/:id/employees", requireAuth, (req: any, res) => {
    if (!checkSiteAccess(req.user, req.params.id)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const employees = db.prepare("SELECT * FROM employees WHERE site_id = ?").all(req.params.id);
    res.json(employees);
  });

  app.get("/api/scanning-data", requireAuth, (req: any, res) => {
    const { siteId, date } = req.query;
    if (!siteId || !checkSiteAccess(req.user, siteId as string, 'admin-data-entry')) {
      return res.status(403).json({ error: "Access denied" });
    }
    const data = db.prepare(`
      SELECT e.id as employee_id, e.name, e.is_active, sd.files, sd.pages, sd.date
      FROM employees e
      LEFT JOIN scanning_data sd ON e.id = sd.employee_id AND sd.date = ?
      WHERE e.site_id = ? AND (e.is_active = 1 OR sd.employee_id IS NOT NULL)
    `).all(date, siteId);
    
    const extra = db.prepare("SELECT extra_pages FROM daily_extra_pages WHERE site_id = ? AND date = ?").get(siteId, date) as any;
    
    res.json({ data, extra_pages: extra?.extra_pages || 0 });
  });

  app.post("/api/scanning-data", requireAuth, (req: any, res) => {
    const { siteId, date, entries, extra_pages } = req.body;
    
    if (!siteId || !checkSiteAccess(req.user, siteId, 'admin-data-entry')) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    if (!date || !Array.isArray(entries)) {
      return res.status(400).json({ error: "Invalid data format" });
    }

    // Basic date format validation (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    // Limit entries to prevent DoS
    if (entries.length > 100) {
      return res.status(400).json({ error: "Too many entries" });
    }

    const dbTransaction = db.transaction(() => {
      // Update individual entries
      const upsertData = db.prepare(`
        INSERT INTO scanning_data (employee_id, date, files, pages)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(employee_id, date) DO UPDATE SET
          files = excluded.files,
          pages = excluded.pages
      `);
      
      for (const entry of entries) {
        upsertData.run(entry.employee_id, date, entry.files || 0, entry.pages || 0);
      }
      
      // Update extra pages
      const upsertExtra = db.prepare(`
        INSERT INTO daily_extra_pages (site_id, date, extra_pages)
        VALUES (?, ?, ?)
        ON CONFLICT(site_id, date) DO UPDATE SET
          extra_pages = excluded.extra_pages
      `);
      upsertExtra.run(siteId, date, extra_pages || 0);
    });
    
    dbTransaction();
    res.json({ success: true });
  });

  app.get("/api/stats/:siteId", requireAuth, (req: any, res) => {
    const siteId = req.params.siteId;
    const mode = req.query.mode || 'main'; // 'main' or 'personal'
    const permission = mode === 'main' ? 'main-view' : 'personal-records';

    if (!checkSiteAccess(req.user, siteId, permission)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const overall = db.prepare(`
      SELECT 
        IFNULL(SUM(sd.files), 0) as total_files, 
        IFNULL(SUM(sd.pages), 0) + (SELECT IFNULL(SUM(extra_pages), 0) FROM daily_extra_pages WHERE site_id = ?) as total_pages,
        s.target_files
      FROM sites s
      LEFT JOIN employees e ON s.id = e.site_id
      LEFT JOIN scanning_data sd ON e.id = sd.employee_id
      WHERE s.id = ?
    `).get(siteId, siteId) as any;

    const monthly = db.prepare(`
      SELECT 
        strftime('%Y-%m', sd.date) as month,
        IFNULL(SUM(sd.files), 0) as files,
        IFNULL(SUM(sd.pages), 0) as personal_pages,
        (
          SELECT IFNULL(SUM(dep.extra_pages), 0) 
          FROM daily_extra_pages dep 
          WHERE dep.site_id = ? AND strftime('%Y-%m', dep.date) = strftime('%Y-%m', sd.date)
        ) as extra_pages
      FROM scanning_data sd
      JOIN employees e ON sd.employee_id = e.id
      WHERE e.site_id = ?
      GROUP BY month
      ORDER BY month DESC
    `).all(siteId, siteId) as any[];

    const formattedMonthly = monthly.map(m => ({
      month: m.month,
      files: m.files,
      pages: mode === 'main' ? (m.personal_pages + m.extra_pages) : m.personal_pages,
      extra_pages: m.extra_pages
    }));

    const weekly = db.prepare(`
      SELECT 
        sd.date,
        IFNULL(SUM(sd.files), 0) as files,
        IFNULL(SUM(sd.pages), 0) + (
          SELECT IFNULL(dep.extra_pages, 0) 
          FROM daily_extra_pages dep 
          WHERE dep.site_id = ? AND dep.date = sd.date
        ) as pages
      FROM scanning_data sd
      JOIN employees e ON sd.employee_id = e.id
      WHERE e.site_id = ?
      GROUP BY sd.date
      ORDER BY sd.date DESC
      LIMIT 30
    `).all(siteId, siteId);

    // If personal mode, we need to subtract the extra pages or just query without them
    if (mode === 'personal') {
      const personalOverall = db.prepare(`
        SELECT 
          IFNULL(SUM(sd.files), 0) as total_files, 
          IFNULL(SUM(sd.pages), 0) as total_pages,
          s.target_files
        FROM sites s
        LEFT JOIN employees e ON s.id = e.site_id
        LEFT JOIN scanning_data sd ON e.id = sd.employee_id
        WHERE s.id = ?
      `).get(siteId) as any;

      const personalWeekly = db.prepare(`
        SELECT 
          date,
          IFNULL(SUM(files), 0) as files,
          IFNULL(SUM(pages), 0) as pages
        FROM scanning_data sd
        JOIN employees e ON sd.employee_id = e.id
        WHERE e.site_id = ?
        GROUP BY date
        ORDER BY date DESC
        LIMIT 30
      `).all(siteId);

      res.json({ overall: personalOverall, monthly: formattedMonthly, weekly: personalWeekly, mode: 'personal' });
    } else {
      res.json({ overall, monthly: formattedMonthly, weekly, mode: 'main' });
    }
  });

  app.get("/api/export/:siteId", requireAuth, (req: any, res) => {
    const siteId = req.params.siteId;
    if (!checkSiteAccess(req.user, siteId, 'admin-reports')) {
      return res.status(403).json({ error: "Access denied" });
    }
    const monthStr = req.query.month as string || format(new Date(), 'yyyy-MM');
    const mode = (req.query.mode as string) || 'personal'; // 'personal' or 'main'
    
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

    const extraPagesData = db.prepare(`
      SELECT * FROM daily_extra_pages 
      WHERE site_id = ? AND date LIKE ?
    `).all(siteId, `${monthStr}%`) as any[];

    // Build the grid
    const aoa: any[][] = [];

    // Summary Table at the top
    aoa.push(["NAME", "FILES", "PAGES"]);
    let grandTotalFiles = 0;
    let grandTotalPages = 0;
    
    employees.forEach(e => {
      const eFiles = scanningData.filter(d => d.employee_id === e.id).reduce((sum, d) => sum + d.files, 0);
      let ePages = scanningData.filter(d => d.employee_id === e.id).reduce((sum, d) => sum + d.pages, 0);
      
      if (mode === 'main') {
        // Calculate extra pages for this employee
        extraPagesData.forEach(ep => {
          const activeOnThisDay = scanningData.filter(d => d.date === ep.date);
          const activeIds = activeOnThisDay.map(d => d.employee_id);
          const isWorkingThisDay = activeIds.includes(e.id);
          
          if (isWorkingThisDay) {
            ePages += getDeterministicSplit(ep.extra_pages, e.id, activeIds, ep.date);
          }
        });
      }

      aoa.push([e.name, eFiles, ePages]);
      grandTotalFiles += eFiles;
      grandTotalPages += ePages;
    });
    aoa.push(["TOTAL", grandTotalFiles, grandTotalPages]);
    aoa.push([]); // Spacer
    aoa.push([]); // Spacer
    
    // Row 1: Title
    const titleRow: any[] = Array(3 + employees.length * 2).fill("");
    titleRow[1] = `${format(startDate, 'MMMM').toUpperCase()} SCANNING (${mode.toUpperCase()})`;
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
      let total = scanningData.filter(d => d.employee_id === e.id).reduce((sum, d) => sum + d.pages, 0);
      if (mode === 'main') {
        extraPagesData.forEach(ep => {
          const activeOnThisDay = scanningData.filter(d => d.date === ep.date).length;
          const isWorkingThisDay = scanningData.some(d => d.date === ep.date && d.employee_id === e.id);
          if (isWorkingThisDay && activeOnThisDay > 0) {
            total += Math.floor(ep.extra_pages / activeOnThisDay);
          }
        });
      }
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
      const extraForDay = extraPagesData.find(ep => ep.date === dateStr)?.extra_pages || 0;
      
      const totalFiles = dayData.reduce((sum, d) => sum + d.files, 0);
      let totalPages = dayData.reduce((sum, d) => sum + d.pages, 0);
      if (mode === 'main') totalPages += extraForDay;
      
      row.push(totalFiles || 0, totalPages || 0);

      if (isSunday(day)) {
        employees.forEach(() => {
          row.push("SUNDAY", "SUNDAY");
        });
      } else {
        employees.forEach(e => {
          const empData = dayData.find(d => d.employee_id === e.id);
          let p = empData?.pages || 0;
          if (mode === 'main' && empData && dayData.length > 0) {
            const activeIds = dayData.map(d => d.employee_id);
            p += getDeterministicSplit(extraForDay, e.id, activeIds, dateStr);
          }
          row.push(empData?.files || 0, p);
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
    const filename = `${monthStr}, ${site.name}, ${mode}.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buf);
  });

  app.delete("/api/sites/:id", requireAuth, (req: any, res) => {
    if (!checkSiteAccess(req.user, req.params.id, 'admin-sites')) {
      return res.status(403).json({ error: "Forbidden" });
    }
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

  app.patch("/api/sites/:id", requireAuth, (req: any, res) => {
    if (!checkSiteAccess(req.user, req.params.id, 'admin-sites')) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { target_files } = req.body;
    db.prepare("UPDATE sites SET target_files = ? WHERE id = ?").run(target_files, req.params.id);
    res.json({ success: true });
  });

  app.post("/api/sites", requireAuth, (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { name, target_files } = req.body;
    
    if (!name || typeof name !== 'string' || name.length < 2 || name.length > 50) {
      return res.status(400).json({ error: "Site name must be between 2 and 50 characters" });
    }

    const insert = db.prepare("INSERT INTO sites (name, target_files) VALUES (?, ?)");
    const result = insert.run(name, target_files || 0);
    res.json({ id: result.lastInsertRowid, name, target_files });
  });

  app.post("/api/employees", requireAuth, (req: any, res) => {
    const { name, site_id } = req.body;
    if (!checkSiteAccess(req.user, site_id, 'admin-operators')) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    if (!name || typeof name !== 'string' || name.length < 2 || name.length > 50) {
      return res.status(400).json({ error: "Employee name must be between 2 and 50 characters" });
    }

    if (!site_id) {
      return res.status(400).json({ error: "Site ID is required" });
    }

    const insert = db.prepare("INSERT INTO employees (name, site_id) VALUES (?, ?)");
    const result = insert.run(name, site_id);
    res.json({ id: result.lastInsertRowid, name, site_id });
  });

  app.delete("/api/employees/:id", requireAuth, (req: any, res) => {
    const employee = db.prepare("SELECT site_id FROM employees WHERE id = ?").get(req.params.id) as any;
    if (!employee || !checkSiteAccess(req.user, employee.site_id, 'admin-operators')) {
      return res.status(403).json({ error: "Forbidden" });
    }
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

  app.get("/api/all-operators", requireAuth, (req: any, res) => {
    const sites = db.prepare("SELECT id FROM sites").all() as any[];
    const accessibleSiteIds = req.user.role === 'admin' 
      ? sites.map(s => s.id)
      : (Array.isArray(req.user.site_access) ? req.user.site_access.map(Number) : []);

    if (accessibleSiteIds.length === 0 && req.user.role !== 'admin' && !req.user.employee_id) return res.json([]);

    let query = `
      SELECT e.*, s.name as site_name 
      FROM employees e 
      JOIN sites s ON e.site_id = s.id 
      WHERE e.is_active = 1
    `;
    let params: any[] = [];

    if (req.user.role !== 'admin') {
      if (req.user.employee_id) {
        query += ` AND e.id = ?`;
        params.push(req.user.employee_id);
      } else if (accessibleSiteIds.length > 0) {
        const placeholders = accessibleSiteIds.map(() => '?').join(',');
        query += ` AND e.site_id IN (${placeholders})`;
        params.push(...accessibleSiteIds);
      } else {
        return res.json([]);
      }
    }

    query += ` ORDER BY s.name, e.name`;
    const operators = db.prepare(query).all(...params);
    res.json(operators);
  });

  app.get("/api/operator-summary/:id", requireAuth, (req: any, res) => {
    const operatorId = req.params.id;
    
    // Security check: if user is linked to an employee, they can only see their own data
    if (req.user.role !== 'admin' && req.user.employee_id && req.user.employee_id != operatorId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const employee = db.prepare("SELECT site_id, rate_per_page FROM employees WHERE id = ?").get(operatorId) as any;
    if (!employee || !checkSiteAccess(req.user, employee.site_id)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const summary = db.prepare(`
      SELECT 
        strftime('%Y-%m', date) as month,
        SUM(files) as total_files,
        SUM(pages) as total_pages,
        SUM(pages * ?) as total_rs
      FROM scanning_data
      WHERE employee_id = ?
      GROUP BY month
      ORDER BY month DESC
    `).all(employee.rate_per_page || 0.30, operatorId);

    res.json(summary);
  });

  app.get("/api/operator-daily/:id", requireAuth, (req: any, res) => {
    const operatorId = req.params.id;
    const { month } = req.query;

    // Security check: if user is linked to an employee, they can only see their own data
    if (req.user.role !== 'admin' && req.user.employee_id && req.user.employee_id != operatorId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const employee = db.prepare("SELECT site_id, rate_per_page FROM employees WHERE id = ?").get(operatorId) as any;
    if (!employee || !checkSiteAccess(req.user, employee.site_id)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const daily = db.prepare(`
      SELECT 
        date,
        files,
        pages,
        (pages * ?) as rs
      FROM scanning_data
      WHERE employee_id = ? AND strftime('%Y-%m', date) = ?
      ORDER BY date ASC
    `).all(employee.rate_per_page || 0.30, operatorId, month);

    res.json(daily);
  });

  app.patch("/api/employees/:id/rate", requireAuth, (req: any, res) => {
    const { rate } = req.body;
    const employee = db.prepare("SELECT site_id FROM employees WHERE id = ?").get(req.params.id) as any;
    if (!employee || !checkSiteAccess(req.user, employee.site_id, 'admin-operators')) {
      return res.status(403).json({ error: "Forbidden" });
    }

    db.prepare("UPDATE employees SET rate_per_page = ? WHERE id = ?").run(rate, req.params.id);
    res.json({ success: true });
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
