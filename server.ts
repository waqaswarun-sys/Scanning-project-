import express from "express";
import session from "express-session";
import { createServer as createViteServer } from "vite";
import * as admin from "firebase-admin";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, FieldPath, Query } from "firebase-admin/firestore";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { Resend } from "resend";

// Simple in-memory cache (60 second TTL)
const cache = new Map<string, { data: any; expires: number }>();
function getCache(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { cache.delete(key); return null; }
  return entry.data;
}
function setCache(key: string, data: any, ttlMs = 60000) {
  cache.set(key, { data, expires: Date.now() + ttlMs });
}
function clearCache(pattern: string) {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) cache.delete(key);
  }
}

declare module 'express-session' {
  interface SessionData {
    user: {
      id: string;
      username: string;
      role: string;
      permissions: string[];
      site_access: string[];
      employee_id?: string;
    };
  }
}

import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSunday, isLastDayOfMonth, addDays, subMonths } from "date-fns";
import bcrypt from "bcryptjs";
import { Site, Employee, ScanningData, Stats } from './src/types.ts';

// Initialize Firebase Admin
import firebaseConfig from './firebase-applet-config.json';

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  initializeApp({
    credential: cert(serviceAccount),
    projectId: firebaseConfig.project_id,
  });
}

const db = getFirestore();
const resend = new Resend(process.env.RESEND_API_KEY);


// Seed default admin if not exists
async function seedData() {
  const usersRef = db.collection('users');
  const adminSnapshot = await usersRef.where('username', '==', 'admin').get();
  
  if (adminSnapshot.empty) {
    const hashedPassword = bcrypt.hashSync('password', 10);
    await usersRef.add({
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
      permissions: ["main-view", "personal-records", "admin-data-entry", "admin-management", "admin-reports", "admin-sites", "admin-operators", "admin-users"],
      site_access: []
    });
    console.log('Seeded default admin');
  }

  const sitesRef = db.collection('sites');
  const sitesSnapshot = await sitesRef.limit(1).get();
  
  if (sitesSnapshot.empty) {
    const multanRef = await sitesRef.add({ name: "Multan", target_files: 100000 });
    const lahoreRef = await sitesRef.add({ name: "Lahore", target_files: 150000 });
    const karachiRef = await sitesRef.add({ name: "Karachi", target_files: 200000 });

    const employeesRef = db.collection('employees');
    const multanId = multanRef.id;
    const lahoreId = lahoreRef.id;
    const karachiId = karachiRef.id;

    for (const name of ["Ali", "Sara", "Ahmed"]) {
      await employeesRef.add({ name, site_id: multanId, is_active: true, rate_per_page: 0.30 });
    }
    for (const name of ["Zain", "Hina"]) {
      await employeesRef.add({ name, site_id: lahoreId, is_active: true, rate_per_page: 0.30 });
    }
    for (const name of ["Omar", "Fatima", "Bilal"]) {
      await employeesRef.add({ name, site_id: karachiId, is_active: true, rate_per_page: 0.30 });
    }
    console.log('Seeded initial sites and employees');
  }
}

seedData().catch(console.error);

// Clean up expired tokens — runs every 6 hours
async function cleanupExpiredTokens() {
  try {
    const now = new Date();
    const expiredTokens = await db.collection('user_tokens')
      .where('expires_at', '<', now)
      .get();
    
    if (!expiredTokens.empty) {
      const batch = db.batch();
      expiredTokens.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log(`[CLEANUP] Deleted ${expiredTokens.docs.length} expired tokens`);
    }
  } catch (err) {
    console.error('[CLEANUP] Token cleanup error:', err);
  }
}

// Also clean up old reset tokens
async function cleanupExpiredResetTokens() {
  try {
    const now = new Date();
    const expiredTokens = await db.collection('password_reset_tokens')
      .where('expires_at', '<', now)
      .get();
    
    if (!expiredTokens.empty) {
      const batch = db.batch();
      expiredTokens.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log(`[CLEANUP] Deleted ${expiredTokens.docs.length} expired reset tokens`);
    }
  } catch (err) {
    console.error('[CLEANUP] Reset token cleanup error:', err);
  }
}

// Run cleanup every 6 hours
setInterval(() => {
  cleanupExpiredTokens().catch(console.error);
  cleanupExpiredResetTokens().catch(console.error);
}, 6 * 60 * 60 * 1000);

// Run once on startup after 30 seconds
setTimeout(() => {
  cleanupExpiredTokens().catch(console.error);
  cleanupExpiredResetTokens().catch(console.error);
}, 30000);
function getDeterministicSplit(totalExtra: number, employeeId: string, allActiveEmployeeIds: string[], dateStr: string) {
  if (allActiveEmployeeIds.length === 0) return 0;
  if (allActiveEmployeeIds.length === 1) return allActiveEmployeeIds[0] === employeeId ? totalExtra : 0;

  const count = allActiveEmployeeIds.length;
  const sortedIds = [...allActiveEmployeeIds].sort();
  const base = Math.floor(totalExtra / count);
  const remainder = totalExtra % count;

  const results: Record<string, number> = {};
  sortedIds.forEach(id => {
    results[id] = base;
  });

  if (remainder > 0) {
    const dateHash = dateStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    for (let i = 0; i < remainder; i++) {
      const luckyIndex = (dateHash + i) % count;
      results[sortedIds[luckyIndex]] += 1;
    }
  }

  return results[employeeId] || 0;
}

// Email daily report sender
// Stores pending timers to avoid duplicate messages
const pendingReportTimers = new Map<string, NodeJS.Timeout>();

async function sendEmailReport(siteId: string, date: string) {
  const adminEmail = process.env.REPORT_EMAIL;
  const managerEmail = process.env.MANAGER_EMAIL;
  console.log(`[EMAIL-REPORT] Starting report for site ${siteId} on ${date}. Admin: ${adminEmail || 'not set'}, Manager: ${managerEmail || 'not set'}`);
  let totalFiles = 0;
  let totalPages = 0;
  try {
    const siteDoc = await db.collection('sites').doc(siteId).get();
    if (!siteDoc.exists) return;
    const siteName = siteDoc.data()?.name || siteId;

    const scanningSnapshot = await db.collection('scanning_data')
      .where('site_id', '==', siteId)
      .where('date', '==', date)
      .get();

    const extraSnapshot = await db.collection('daily_extra_pages')
      .where('site_id', '==', siteId)
      .where('date', '==', date)
      .get();
    
    const extraPages = extraSnapshot.empty ? 0 : (extraSnapshot.docs[0].data().extra_pages || 0);

    const employeesSnapshot = await db.collection('employees').where('site_id', '==', siteId).get();
    const employeesMap = new Map();
    employeesSnapshot.docs.forEach(doc => employeesMap.set(doc.id, doc.data().name));

    const usersSnapshot = await db.collection('users').where('role', '==', 'user').get();
    const operatorUsers = usersSnapshot.docs.filter(doc => doc.data().employee_id && doc.data().email);

    const [year, month, day] = date.split('-');
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const formattedDate = `${parseInt(day)} ${monthNames[parseInt(month)-1]} ${year}`;

    // 1. Send Individual Reports to Operators
    for (const userDoc of operatorUsers) {
      const userData = userDoc.data();
      const empData = scanningSnapshot.docs.find(d => d.data().employee_id === userData.employee_id);
      
      if (empData) {
        const files = empData.data().files || 0;
        const pages = empData.data().pages || 0;
        
        // Fetch employee rate for Rs calculation
        const empDoc = await db.collection('employees').doc(userData.employee_id).get();
        const rate = empDoc.data()?.rate_per_page || 0.30;
        const amount = pages * rate;

        await resend.emails.send({
          from: 'ScanTrack Pro <noreply@scantrackpro.online>',
          to: userData.email,
          subject: `📊 Your Daily Report - ${formattedDate}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
              <div style="background: #4f46e5; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 20px;">📊 Daily Work Report</h1>
              </div>
              <div style="background: white; border: 1px solid #e2e8f0; border-top: none; padding: 32px; border-radius: 0 0 12px 12px;">
                <p>Hi <strong>${userData.username}</strong>, here is your work summary for today:</p>
                <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Date</td>
                    <td style="padding: 8px 0; font-weight: bold; text-align: right;">${formattedDate}</td>
                  </tr>
                  <tr style="border-top: 1px solid #e2e8f0;">
                    <td style="padding: 12px 0; color: #64748b; font-size: 14px;">Files Scanned</td>
                    <td style="padding: 12px 0; font-weight: bold; font-size: 18px; text-align: right; color: #4f46e5;">${files.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Pages Scanned</td>
                    <td style="padding: 8px 0; font-weight: bold; font-size: 18px; text-align: right; color: #4f46e5;">${pages.toLocaleString()}</td>
                  </tr>
                  <tr style="border-top: 2px solid #f1f5f9;">
                    <td style="padding: 12px 0; color: #1e293b; font-weight: bold; font-size: 14px;">Total Amount</td>
                    <td style="padding: 12px 0; font-weight: bold; font-size: 20px; text-align: right; color: #10b981;">Rs ${amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  </tr>
                </table>
              </div>
            </div>
          `
        });
      }
    }

    // 2. Send Summary Report to Admin
    if (adminEmail) {
      let operatorRows = '';

      scanningSnapshot.docs.forEach(doc => {
        const d = doc.data();
        const name = employeesMap.get(d.employee_id) || 'Unknown';
        operatorRows += `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${name}</td>
            <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; text-align: right;">${(d.files || 0).toLocaleString()}</td>
            <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; text-align: right;">${(d.pages || 0).toLocaleString()}</td>
          </tr>
        `;
        totalFiles += (d.files || 0);
        totalPages += (d.pages || 0);
      });

      await resend.emails.send({
        from: 'ScanTrack Pro <noreply@scantrackpro.online>',
        to: adminEmail,
        subject: `📊 Admin Daily Report - ${siteName} - ${formattedDate}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="background: #1e293b; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 20px;">📊 Site Summary: ${siteName}</h1>
              <p style="color: #94a3b8; margin: 4px 0 0 0;">${formattedDate}</p>
            </div>
            <div style="background: white; border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f8fafc;">
                    <th style="padding: 10px; text-align: left; font-size: 12px; color: #64748b;">OPERATOR</th>
                    <th style="padding: 10px; text-align: right; font-size: 12px; color: #64748b;">FILES</th>
                    <th style="padding: 10px; text-align: right; font-size: 12px; color: #64748b;">PAGES</th>
                  </tr>
                </thead>
                <tbody>
                  ${operatorRows || '<tr><td colspan="3" style="padding: 20px; text-align: center; color: #94a3b8;">No data entered today</td></tr>'}
                </tbody>
                <tfoot>
                  <tr style="font-weight: bold; background: #f1f5f9;">
                    <td style="padding: 10px;">Sub-Total</td>
                    <td style="padding: 10px; text-align: right;">${totalFiles.toLocaleString()}</td>
                    <td style="padding: 10px; text-align: right;">${totalPages.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px; color: #64748b;">Extra Pages</td>
                    <td></td>
                    <td style="padding: 10px; text-align: right; color: #4f46e5;">+ ${extraPages.toLocaleString()}</td>
                  </tr>
                  <tr style="font-weight: bold; background: #4f46e5; color: white;">
                    <td style="padding: 12px;">GRAND TOTAL</td>
                    <td style="padding: 12px; text-align: right;">${totalFiles.toLocaleString()}</td>
                    <td style="padding: 12px; text-align: right;">${(totalPages + extraPages).toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        `
      });
    }

    // 3. Send Summary Report to Manager
    if (managerEmail) {
      const grandTotalFiles = totalFiles;
      const grandTotalPages = totalPages + extraPages;

      console.log(`[EMAIL-REPORT] Sending manager report to ${managerEmail}...`);
      try {
        await resend.emails.send({
          from: 'ScanTrack Pro <noreply@scantrackpro.online>',
          to: managerEmail,
          subject: `📋 Manager Daily Report - ${siteName} - ${formattedDate}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #1e293b; margin-top: 0; font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">📋 Manager Daily Report</h2>
              
              <div style="padding: 16px 0;">
                <p style="margin: 8px 0; color: #64748b;">Site: <strong style="color: #1e293b;">${siteName}</strong></p>
                <p style="margin: 8px 0; color: #64748b;">Date: <strong style="color: #1e293b;">${formattedDate}</strong></p>
                
                <div style="margin-top: 16px; padding: 16px; background: #4f46e5; color: white; border-radius: 8px; text-align: center;">
                  <p style="margin: 0; font-size: 12px; opacity: 0.8; text-transform: uppercase;">Grand Total</p>
                  <div style="display: flex; justify-content: space-around; margin-top: 8px;">
                    <div>
                      <p style="margin: 0; font-size: 20px; font-weight: bold;">${grandTotalFiles.toLocaleString()}</p>
                      <p style="margin: 0; font-size: 10px; opacity: 0.8;">FILES</p>
                    </div>
                    <div>
                      <p style="margin: 0; font-size: 20px; font-weight: bold;">${grandTotalPages.toLocaleString()}</p>
                      <p style="margin: 0; font-size: 10px; opacity: 0.8;">PAGES</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div style="margin-top: 20px; padding: 16px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; font-weight: bold; text-transform: uppercase;">👇 Copy-Ready Text:</p>
                <div style="font-family: 'Courier New', monospace; font-size: 15px; color: #1e293b; white-space: pre-wrap; line-height: 1.5;">${formattedDate}
Total Files ${grandTotalFiles.toLocaleString()}
Total Pages ${grandTotalPages.toLocaleString()}</div>
              </div>
              
              <p style="margin-top: 16px; font-size: 11px; color: #94a3b8; text-align: center;">Sent via ScanTrack Pro Automated System</p>
            </div>
          `
        });
        console.log(`[EMAIL-REPORT] Manager report sent successfully to ${managerEmail}`);
      } catch (err) {
        console.error(`[EMAIL-REPORT] Failed to send manager report to ${managerEmail}:`, err);
      }
    } else {
      console.log(`[EMAIL-REPORT] Manager email not sent because MANAGER_EMAIL is not set.`);
    }

    console.log(`[EMAIL-REPORT] Reports sent for ${siteName} on ${date}`);

    // Check if it's the last day of the month to trigger monthly reports
    const parsedDate = parseISO(date);
    if (isLastDayOfMonth(parsedDate)) {
      console.log(`[MONTHLY-REPORT] Last day of month detected (${date}), triggering monthly reports...`);
      await sendMonthlyReports(siteId, format(parsedDate, 'yyyy-MM'));
    }
  } catch (err) {
    console.error('[EMAIL-REPORT] Error sending emails:', err);
  }
}

async function sendMonthlyReports(siteId: string, monthStr: string) {
  try {
    const siteDoc = await db.collection('sites').doc(siteId).get();
    if (!siteDoc.exists) return;
    const siteName = siteDoc.data()?.name || siteId;

    const employeesSnapshot = await db.collection('employees').where('site_id', '==', siteId).get();
    const employees = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

    const usersSnapshot = await db.collection('users').where('role', '==', 'user').get();
    const operatorUsers = usersSnapshot.docs.filter(doc => doc.data().employee_id && doc.data().email);

    const startDate = startOfMonth(parseISO(monthStr + "-01"));
    const endDate = endOfMonth(startDate);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const scanningSnapshot = await db.collection('scanning_data')
      .where('site_id', '==', siteId)
      .where('date', '>=', monthStr + "-01")
      .where('date', '<=', monthStr + "-31")
      .get();
    const scanningData = scanningSnapshot.docs.map(doc => doc.data());

    const monthName = format(startDate, 'MMMM yyyy');

    for (const userDoc of operatorUsers) {
      const userData = userDoc.data();
      const employee = employees.find(e => e.id === userData.employee_id);
      if (!employee) continue;

      const rate = employee.rate_per_page || 0.30;
      let totalFiles = 0;
      let totalPages = 0;
      let totalEarnings = 0;
      let tableRows = '';

      days.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayData = scanningData.find(d => d.employee_id === employee.id && d.date === dateStr);
        
        const files = dayData?.files || 0;
        const pages = dayData?.pages || 0;
        const earnings = pages * rate;

        totalFiles += files;
        totalPages += pages;
        totalEarnings += earnings;

        if (files > 0 || pages > 0 || isSunday(day)) {
          tableRows += `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-size: 13px;">${format(day, 'dd MMM')} ${isSunday(day) ? '(Sun)' : ''}</td>
              <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; text-align: right;">${files.toLocaleString()}</td>
              <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; text-align: right;">${pages.toLocaleString()}</td>
              <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; text-align: right;">Rs. ${earnings.toFixed(2)}</td>
            </tr>
          `;
        }
      });

      if (totalPages > 0) {
        await resend.emails.send({
          from: 'ScanTrack Pro <noreply@scantrackpro.online>',
          to: userData.email,
          subject: `📜 Monthly Summary - ${monthName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <div style="background: #4f46e5; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 20px;">📜 Monthly Work Summary</h1>
                <p style="color: #e0e7ff; margin: 4px 0 0 0;">${monthName} | ${employee.name}</p>
              </div>
              <div style="background: white; border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="background: #f8fafc;">
                      <th style="padding: 10px; text-align: left; font-size: 12px; color: #64748b;">DATE</th>
                      <th style="padding: 10px; text-align: right; font-size: 12px; color: #64748b;">FILES</th>
                      <th style="padding: 10px; text-align: right; font-size: 12px; color: #64748b;">PAGES</th>
                      <th style="padding: 10px; text-align: right; font-size: 12px; color: #64748b;">EARNINGS</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tableRows}
                  </tbody>
                </table>
                <div style="margin-top: 24px; padding: 20px; background: #f8fafc; border-radius: 12px;">
                  <h3 style="margin: 0 0 16px 0; color: #1e293b; font-size: 16px;">Final Summary</h3>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: #64748b;">Total Files</span>
                    <span style="font-weight: bold;">${totalFiles.toLocaleString()}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: #64748b;">Total Pages</span>
                    <span style="font-weight: bold;">${totalPages.toLocaleString()}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
                    <span style="color: #1e293b; font-weight: bold;">TOTAL AMOUNT</span>
                    <span style="color: #4f46e5; font-weight: bold; font-size: 20px;">Rs. ${totalEarnings.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          `
        });
        console.log(`[MONTHLY-REPORT] Sent to ${userData.username} (${userData.email})`);
      }
    }
    
    // Mark this month as reported for this site to avoid duplicates in backup scheduler
    await db.collection('monthly_report_logs').doc(`${siteId}_${monthStr}`).set({
      sent_at: FieldValue.serverTimestamp(),
      site_id: siteId,
      month: monthStr
    });

  } catch (err) {
    console.error('[MONTHLY-REPORT] Error:', err);
  }
}

// Backup scheduler to catch missed monthly reports (runs every hour)
setInterval(async () => {
  const now = new Date();
  // Check if it's the 1st of the month and between 9:00 AM and 10:00 AM
  if (now.getDate() === 1 && now.getHours() === 9) {
    const lastMonth = subMonths(now, 1);
    const monthStr = format(lastMonth, 'yyyy-MM');
    console.log(`[BACKUP-SCHEDULER] Checking for missed reports for ${monthStr}...`);
    
    try {
      const sitesSnapshot = await db.collection('sites').get();
      for (const siteDoc of sitesSnapshot.docs) {
        const logDoc = await db.collection('monthly_report_logs').doc(`${siteDoc.id}_${monthStr}`).get();
        if (!logDoc.exists) {
          console.log(`[BACKUP-SCHEDULER] Report missing for site ${siteDoc.id}, sending now...`);
          await sendMonthlyReports(siteDoc.id, monthStr);
        }
      }
    } catch (err) {
      console.error('[BACKUP-SCHEDULER] Error:', err);
    }
  }
}, 60 * 60 * 1000); // Every hour

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Compression - responses 70% smaller
  app.use(compression());

  app.use(express.json());
  app.set('trust proxy', 1); // trust first proxy

  // Rate limiting - max 5 login attempts per 15 minutes per IP
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(session({
    secret: process.env.SESSION_SECRET || 'scanning-track-v1',
    resave: false,
    saveUninitialized: false,
    rolling: false,
    name: 'scantrack.sid',
    proxy: true,
    cookie: { 
      secure: true, 
      sameSite: 'none',
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
  }));

  // Debug middleware to log session state
  app.use((req: any, res: any, next: any) => {
    if (req.url.startsWith('/api/')) {
      const hasSession = !!(req.session && req.session.user);
      const hasToken = !!(req.headers['x-auth-token']);
      const hasCookie = !!(req.headers.cookie && req.headers.cookie.includes('scantrack.sid'));
      console.log(`[DEBUG] ${req.method} ${req.url} - Session: ${hasSession}, Token: ${hasToken}, Cookie: ${hasCookie}`);
    }
    next();
  });

  // Auth Middleware
  const requireAuth = async (req: any, res: any, next: any) => {
    const token = req.headers['x-auth-token'] || req.query.token;
    
    if (token && typeof token === 'string' && token.length > 0) {
      try {
        const tokenSnapshot = await db.collection('user_tokens').doc(token).get();
        
        if (tokenSnapshot.exists) {
          const tokenData = tokenSnapshot.data();

          // Check token expiry
          if (tokenData?.expires_at && tokenData.expires_at.toDate() < new Date()) {
            console.log(`[AUTH] Token expired, deleting...`);
            await db.collection('user_tokens').doc(token).delete();
          } else {
            const userSnapshot = await db.collection('users').doc(tokenData?.user_id).get();
            
            if (userSnapshot.exists) {
              const userData = userSnapshot.data();
              req.user = {
                id: userSnapshot.id,
                username: userData?.username,
                role: userData?.role,
                employee_id: userData?.employee_id,
                permissions: userData?.permissions || [],
                site_access: userData?.site_access || []
              };
              console.log(`[AUTH] Authorized via token: ${userData?.username}`);
              return next();
            }
          }
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

  const checkSiteAccess = (user: any, siteId: string | number, permission?: string) => {
    if (user.role === 'admin') return true;
    
    // Check global permission first
    if (permission && !user.permissions?.includes(permission)) return false;
    
    // Check site access
    const accessibleSites = Array.isArray(user.site_access) ? user.site_access.map(String) : [];
    if (!accessibleSites.includes(String(siteId))) return false;
    
    return true;
  };

  // Auth Routes
  app.post("/api/login", loginLimiter, async (req: any, res: any) => {
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
      const usersRef = db.collection('users');
      const userSnapshot = await usersRef.where('username', '==', username).get();
      
      if (userSnapshot.empty) {
        console.log(`[AUTH] User not found: ${username}`);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const userDoc = userSnapshot.docs[0];
      const user = userDoc.data();
      
      if (user && bcrypt.compareSync(password, user.password)) {
        console.log(`[AUTH] User found: ${username}, ID: ${userDoc.id}, role: ${user.role}`);
        const userData = {
          id: userDoc.id,
          username: user.username,
          role: user.role,
          employee_id: user.employee_id,
          permissions: user.permissions || [],
          site_access: user.site_access || []
        };

        // Generate token with 7 day expiry
        const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
        const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        console.log(`[AUTH] Generating token for ${username}`);
        await db.collection('user_tokens').doc(token).set({
          user_id: userDoc.id,
          created_at: FieldValue.serverTimestamp(),
          expires_at: tokenExpiry
        });

        // Set session user directly
        req.session.user = userData;
        
        // Save session explicitly before responding
        req.session.save((err: any) => {
          if (err) {
            console.error('[AUTH] Session save error:', err);
            return res.status(500).json({ error: "Failed to save session" });
          }
          console.log(`[AUTH] Login successful for ${username}. SessionID: ${req.sessionID}`);
          res.json({ success: true, user: userData, token });
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

  app.get("/api/me", async (req: any, res: any) => {
    try {
      const token = req.headers['x-auth-token'] || req.query.token;
      const sessionUser = req.session?.user;
      
      console.log(`[AUTH] /api/me check. Path: ${req.url}, Token: ${token ? token.substring(0, 8) + '...' : 'missing'}, Session: ${sessionUser ? sessionUser.username : 'missing'}`);
      
      if (token && typeof token === 'string' && token.length > 0) {
        const tokenSnapshot = await db.collection('user_tokens').doc(token).get();
        if (tokenSnapshot.exists) {
          const tokenData = tokenSnapshot.data();
          const userSnapshot = await db.collection('users').doc(tokenData?.user_id).get();
          
          if (userSnapshot.exists) {
              const user = userSnapshot.data();
              let employee_name = null;
              if (user?.employee_id) {
                try {
                  const empDoc = await db.collection('employees').doc(user.employee_id).get();
                  if (empDoc.exists) employee_name = empDoc.data()?.name || null;
                } catch(e) {}
              }
              const userData = {
                id: userSnapshot.id,
                username: user?.username,
                role: user?.role,
                employee_id: user?.employee_id,
                employee_name,
                permissions: user?.permissions || [],
                site_access: user?.site_access || []
              };
              console.log(`[AUTH] /api/me success via token for ${userData.username}`);
            
            // Sync session if it's missing but token is valid
            if (req.session && !req.session.user) {
              console.log(`[AUTH] Syncing session for ${userData.username}`);
              req.session.user = userData;
            }
            
            return res.json(userData);
          }
        }
      }
      
      if (req.session && req.session.user) {
        // Refresh user data from DB to ensure it's up to date
        const userSnapshot = await db.collection('users').doc(req.session.user.id).get();
        if (userSnapshot.exists) {
          const user = userSnapshot.data();
          let employee_name = null;
          if (user?.employee_id) {
            try {
              const empDoc = await db.collection('employees').doc(user.employee_id).get();
              if (empDoc.exists) employee_name = empDoc.data()?.name || null;
            } catch(e) {}
          }
          const userData = {
            id: userSnapshot.id,
            username: user?.username,
            role: user?.role,
            employee_id: user?.employee_id,
            employee_name,
            permissions: user?.permissions || [],
            site_access: user?.site_access || []
          };
          req.session.user = userData; // Update session
          console.log(`[AUTH] /api/me found user via session: ${userData.username}`);
          return res.json(userData);
        } else {
          console.log(`[AUTH] /api/me session user ID ${req.session.user.id} not found in DB`);
        }
      }
      
      console.log(`[AUTH] /api/me failed. Token: ${token ? 'present' : 'missing'}, Session: ${sessionUser ? 'present' : 'missing'}`);
      res.status(401).json({ error: "Unauthorized" });
    } catch (err) {
      console.error('[AUTH] /api/me error:', err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/logout", async (req, res) => {
    const token = req.headers['x-auth-token'] || req.query.token;
    if (token) {
      try {
        const tokenSnapshot = await db.collection('user_tokens').where('token', '==', String(token)).get();
        const batch = db.batch();
        tokenSnapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      } catch (err) {
        console.error('[LOGOUT] Token delete error:', err);
      }
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

  // Forgot Password
  app.post("/api/forgot-password", async (req: any, res: any) => {
    const { username, email } = req.body;
    if (!username || !email) {
      return res.status(400).json({ error: "Username and email required" });
    }
    try {
      const userSnapshot = await db.collection('users').where('username', '==', username).get();
      if (userSnapshot.empty) {
        // Don't reveal user doesn't exist
        return res.json({ success: true });
      }
      const userDoc = userSnapshot.docs[0];
      const user = userDoc.data();

      // Block admin reset via email
      if (user.role === 'admin') {
        return res.json({ success: true });
      }

      // Check email matches
      if (!user.email || user.email.toLowerCase() !== email.toLowerCase()) {
        return res.json({ success: true });
      }

      // Generate reset token (1 hour expiry)
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await db.collection('password_reset_tokens').doc(token).set({
        user_id: userDoc.id,
        expires_at: expires,
        created_at: FieldValue.serverTimestamp()
      });

      const resetUrl = `https://scantrackpro.online/reset-password?token=${token}`;
      await resend.emails.send({
        from: 'ScanTrack Pro <noreply@scantrackpro.online>',
        to: user.email,
        subject: 'Password Reset Request',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <div style="background: #4f46e5; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">ScanTrack Pro</h1>
            </div>
            <div style="background: white; border: 1px solid #e2e8f0; border-top: none; padding: 32px; border-radius: 0 0 12px 12px;">
              <h2 style="color: #1e293b; margin-top: 0;">Password Reset Request</h2>
              <p style="color: #64748b;">Hi <strong>${user.username}</strong>, we received a request to reset your password.</p>
              <a href="${resetUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">Reset Password</a>
              <p style="color: #94a3b8; font-size: 12px;">This link expires in 1 hour. If you did not request this, ignore this email.</p>
            </div>
          </div>
        `
      });

      console.log(`[FORGOT-PASSWORD] Reset email sent to ${user.email}`);
      res.json({ success: true });
    } catch (err) {
      console.error('[FORGOT-PASSWORD] Error:', err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Reset Password
  app.post("/api/reset-password", async (req: any, res: any) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "Invalid request. Password must be at least 6 characters." });
    }
    try {
      const tokenDoc = await db.collection('password_reset_tokens').doc(token).get();
      if (!tokenDoc.exists) {
        return res.status(400).json({ error: "Invalid or expired reset link." });
      }
      const tokenData = tokenDoc.data();
      if (tokenData?.expires_at.toDate() < new Date()) {
        await db.collection('password_reset_tokens').doc(token).delete();
        return res.status(400).json({ error: "Reset link has expired. Please request a new one." });
      }

      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      await db.collection('users').doc(tokenData?.user_id).update({
        password: hashedPassword,
        updated_at: FieldValue.serverTimestamp()
      });

      // Delete used token
      await db.collection('password_reset_tokens').doc(token).delete();
      console.log(`[RESET-PASSWORD] Password reset for user ${tokenData?.user_id}`);
      res.json({ success: true });
    } catch (err) {
      console.error('[RESET-PASSWORD] Error:', err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/update-profile", requireAuth, async (req: any, res: any) => {
    const { username, currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    
    try {
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      if (!userDoc.exists) return res.status(404).json({ error: "User not found" });
      const user = userDoc.data();

      const updates: any = {};

      // If changing password, verify current password
      if (newPassword) {
        if (!currentPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
          return res.status(400).json({ error: "New password must be at least 6 characters" });
        }

        if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
          return res.status(400).json({ error: "Current password incorrect" });
        }
        updates.password = bcrypt.hashSync(newPassword, 10);
      }

      // If changing username
      if (username && username !== req.user.username) {
        if (typeof username !== 'string' || username.length < 3 || username.length > 20) {
          return res.status(400).json({ error: "Username must be between 3 and 20 characters" });
        }
        
        const existingUser = await db.collection('users').where('username', '==', username).get();
        if (!existingUser.empty) {
          return res.status(400).json({ error: "Username already exists" });
        }
        updates.username = username;
      }
      
      if (Object.keys(updates).length > 0) {
        await userRef.update(updates);
      }
      
      res.json({ success: true });
    } catch (err) {
      console.error('[UPDATE-PROFILE] Error:', err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // User Management Routes
  app.get("/api/users", requireAuth, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    try {
      const usersSnapshot = await db.collection('users').get();
      const users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      res.json(users.map((u: any) => ({ 
        ...u,
        password: undefined, // Never expose password hash
        permissions: u.permissions || [],
        site_access: u.site_access || [],
        employee_id: u.employee_id
      })));
    } catch (err) {
      console.error('[USERS] Fetch error:', err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/users", requireAuth, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { username, password, role, permissions, site_access, employee_id, email } = req.body;
    
    if (!username || !password || typeof username !== 'string' || username.length < 3) {
      return res.status(400).json({ error: "Invalid username or password" });
    }

    try {
      const usersRef = db.collection('users');
      const existingUser = await usersRef.where('username', '==', username).get();
      if (!existingUser.empty) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const hashedPassword = bcrypt.hashSync(password, 10);
      await usersRef.add({
        username, 
        password: hashedPassword, 
        role: role || 'user', 
        permissions: permissions || [],
        site_access: site_access || [],
        employee_id: employee_id || null,
        email: email || null,
        created_at: FieldValue.serverTimestamp()
      });
      res.json({ success: true });
    } catch (e) {
      console.error('[USERS] Create error:', e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/users/:id", requireAuth, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { username, password, role, permissions, site_access, employee_id, email } = req.body;
    const userId = req.params.id;
    
    if (!username || typeof username !== 'string' || username.length < 3) {
      return res.status(400).json({ error: "Invalid username" });
    }

    try {
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: "User not found" });
      }

      const updateData: any = {
        username,
        role: role || 'user',
        permissions: permissions || [],
        site_access: site_access || [],
        employee_id: employee_id || null,
        email: email || null,
        updated_at: FieldValue.serverTimestamp()
      };

      if (password && typeof password === 'string' && password.length >= 6) {
        updateData.password = bcrypt.hashSync(password, 10);
      }

      await userRef.update(updateData);
      res.json({ success: true });
    } catch (e) {
      console.error('[USERS] Update error:', e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/users/:id", requireAuth, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    if (req.params.id === req.user.id) return res.status(400).json({ error: "Cannot delete yourself" });
    try {
      await db.collection('users').doc(req.params.id).delete();
      res.json({ success: true });
    } catch (err) {
      console.error('[USERS] Delete error:', err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // API Routes
  app.get("/api/sites", requireAuth, async (req: any, res) => {
    try {
      const sitesSnapshot = await db.collection('sites').get();
      const sites = sitesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      if (req.user.role === 'admin') {
        return res.json(sites);
      }
      const access = Array.isArray(req.user.site_access) ? req.user.site_access.map(String) : [];
      const filteredSites = sites.filter(s => access.includes(String(s.id)));
      res.json(filteredSites);
    } catch (err) {
      console.error('[SITES] Fetch error:', err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/sites-summary", requireAuth, async (req: any, res) => {
    const cacheKey = `sites-summary-${req.user.role}-${req.user.id}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    try {
      const sitesSnapshot = await db.collection('sites').get();
      const accessibleSiteIds = req.user.role === 'admin' 
        ? sitesSnapshot.docs.map(doc => doc.id)
        : (Array.isArray(req.user.site_access) ? req.user.site_access.map(String) : []);

      if (accessibleSiteIds.length === 0) return res.json([]);

      // Fetch all scanning_data and extra_pages in 2 calls instead of N*2 calls
      const [scanningSnapshot, extraSnapshot] = await Promise.all([
        db.collection('scanning_data').get(),
        db.collection('daily_extra_pages').get()
      ]);

      // Build maps for fast lookup
      const scanningBySite = new Map<string, { files: number; pages: number }>();
      scanningSnapshot.docs.forEach(doc => {
        const d = doc.data();
        const existing = scanningBySite.get(d.site_id) || { files: 0, pages: 0 };
        existing.files += (d.files || 0);
        existing.pages += (d.pages || 0);
        scanningBySite.set(d.site_id, existing);
      });

      const extraBySite = new Map<string, number>();
      extraSnapshot.docs.forEach(doc => {
        const d = doc.data();
        extraBySite.set(d.site_id, (extraBySite.get(d.site_id) || 0) + (d.extra_pages || 0));
      });

      const summary = accessibleSiteIds.map(siteId => {
        const siteDoc = sitesSnapshot.docs.find(doc => doc.id === siteId);
        if (!siteDoc) return null;
        const siteData = siteDoc.data();
        const scanning = scanningBySite.get(siteId) || { files: 0, pages: 0 };
        const extraPages = extraBySite.get(siteId) || 0;
        return {
          id: siteId,
          name: siteData.name,
          total_files: scanning.files,
          total_pages: scanning.pages + extraPages,
          extra_pages: extraPages
        };
      }).filter(Boolean);

      setCache(cacheKey, summary);
      res.json(summary);
    } catch (err) {
      console.error('[SITES-SUMMARY] Error:', err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/operators-summary", requireAuth, async (req: any, res) => {
    const { siteId, month } = req.query;
    
    if (siteId && !checkSiteAccess(req.user, siteId as string)) {
      return res.status(403).json({ error: "Access denied to this site" });
    }

    const cacheKey = `operators-summary-${siteId || 'all'}-${month || 'all'}-${req.user.id}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    try {
      const sitesSnapshot = await db.collection('sites').get();
      const sitesMap = new Map();
      sitesSnapshot.docs.forEach(doc => sitesMap.set(doc.id, doc.data().name));

      const accessibleSiteIds = req.user.role === 'admin' 
        ? sitesSnapshot.docs.map(doc => doc.id)
        : (Array.isArray(req.user.site_access) ? req.user.site_access.map(String) : []);

      if (req.user.role !== 'admin' && accessibleSiteIds.length === 0) return res.json([]);

      let employeesQuery: Query = db.collection('employees').where('is_active', '==', true);
      if (siteId) {
        employeesQuery = employeesQuery.where('site_id', '==', String(siteId));
      } else if (req.user.role !== 'admin') {
        if (accessibleSiteIds.length <= 10) {
          employeesQuery = employeesQuery.where('site_id', 'in', accessibleSiteIds);
        }
      }

      const employeesSnapshot = await employeesQuery.get();
      const employees = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

      if (employees.length === 0) return res.json([]);

      // Fetch all scanning data in ONE call instead of N calls
      let scanningQuery: Query = db.collection('scanning_data');
      if (siteId) {
        scanningQuery = scanningQuery.where('site_id', '==', String(siteId));
      }
      if (month) {
        scanningQuery = scanningQuery
          .where('date', '>=', month + "-01")
          .where('date', '<=', month + "-31");
      }
      const scanningSnapshot = await scanningQuery.get();

      // Build map: employee_id -> { files, pages }
      const scanningByEmployee = new Map<string, { files: number; pages: number }>();
      scanningSnapshot.docs.forEach(doc => {
        const d = doc.data();
        const existing = scanningByEmployee.get(d.employee_id) || { files: 0, pages: 0 };
        existing.files += (d.files || 0);
        existing.pages += (d.pages || 0);
        scanningByEmployee.set(d.employee_id, existing);
      });

      const summary = employees.map((e: any) => {
        const totals = scanningByEmployee.get(e.id) || { files: 0, pages: 0 };
        return {
          id: e.id,
          name: e.name,
          site_name: sitesMap.get(e.site_id) || 'Unknown',
          total_files: totals.files,
          total_pages: totals.pages
        };
      });

      setCache(cacheKey, summary, 60000);
      res.json(summary);
    } catch (err) {
      console.error('[OPERATORS-SUMMARY] Error:', err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/sites/:id/employees", requireAuth, async (req: any, res) => {
    if (!checkSiteAccess(req.user, req.params.id)) {
      return res.status(403).json({ error: "Access denied" });
    }
    try {
      const employeesSnapshot = await db.collection('employees').where('site_id', '==', req.params.id).get();
      const employees = employeesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      res.json(employees);
    } catch (err) {
      console.error('[EMPLOYEES] Fetch error:', err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/scanning-data", requireAuth, async (req: any, res) => {
    const { siteId, date } = req.query;
    if (!siteId || !checkSiteAccess(req.user, siteId as string, 'admin-data-entry')) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    try {
      // Get all employees for this site
      const employeesSnapshot = await db.collection('employees').where('site_id', '==', siteId).get();
      const employees = employeesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      // Get scanning data for this site and date
      const scanningSnapshot = await db.collection('scanning_data')
        .where('site_id', '==', siteId)
        .where('date', '==', date)
        .get();
      
      const scanningDataMap = new Map();
      scanningSnapshot.docs.forEach(doc => {
        const data = doc.data();
        scanningDataMap.set(data.employee_id, data);
      });

      const data = employees
        .filter(e => e.is_active || scanningDataMap.has(e.id))
        .map(e => {
          const sd = scanningDataMap.get(e.id);
          return {
            employee_id: e.id,
            name: e.name,
            is_active: e.is_active,
            files: sd ? sd.files : null,
            pages: sd ? sd.pages : null,
            date: date
          };
        });
      
      const extraSnapshot = await db.collection('daily_extra_pages')
        .where('site_id', '==', siteId)
        .where('date', '==', date)
        .get();
      
      const extraPages = extraSnapshot.empty ? 0 : extraSnapshot.docs[0].data().extra_pages;
      
      res.json({ data, extra_pages: extraPages });
    } catch (err) {
      console.error('[SCANNING_DATA] Fetch error:', err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/scanning-data", requireAuth, async (req: any, res) => {
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

    try {
      const batch = db.batch();

      // Update individual entries
      for (const entry of entries) {
        const { employee_id, files, pages } = entry;
        if (employee_id && files !== null && pages !== null) {
          const docId = `${employee_id}_${date}`;
          const docRef = db.collection('scanning_data').doc(docId);
          batch.set(docRef, {
            employee_id,
            site_id: siteId,
            date,
            files: Number(files),
            pages: Number(pages),
            updated_at: FieldValue.serverTimestamp()
          }, { merge: true });
        }
      }

      // Update extra pages
      const extraDocId = `${siteId}_${date}`;
      const extraRef = db.collection('daily_extra_pages').doc(extraDocId);
      batch.set(extraRef, {
        site_id: siteId,
        date,
        extra_pages: Number(extra_pages || 0),
        updated_at: FieldValue.serverTimestamp()
      }, { merge: true });

      await batch.commit();
      // Clear caches so fresh data loads
      clearCache(`stats-${siteId}`);
      clearCache('sites-summary');
      clearCache('operators-summary');

      // Schedule Email report 1 minute after save
      // Cancel previous timer for same site+date to avoid duplicates
      const timerKey = `${siteId}_${date}`;
      if (pendingReportTimers.has(timerKey)) {
        clearTimeout(pendingReportTimers.get(timerKey)!);
      }
      const timer = setTimeout(() => {
        sendEmailReport(siteId, date).catch(console.error);
        pendingReportTimers.delete(timerKey);
      }, 60 * 1000); // 1 minute
      pendingReportTimers.set(timerKey, timer);

      res.json({ success: true });
    } catch (err) {
      console.error('[SCANNING_DATA] Save error:', err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/stats/:siteId", requireAuth, async (req: any, res) => {
    const siteId = req.params.siteId;
    const mode = req.query.mode || 'main';
    const permission = mode === 'main' ? 'main-view' : 'personal-records';

    if (!checkSiteAccess(req.user, siteId, permission)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const cacheKey = `stats-${siteId}-${mode}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    try {
      const siteDoc = await db.collection('sites').doc(siteId).get();
      if (!siteDoc.exists) return res.status(404).json({ error: "Site not found" });
      const site = siteDoc.data();

      const scanningSnapshot = await db.collection('scanning_data').where('site_id', '==', siteId).get();
      const scanningData = scanningSnapshot.docs.map(doc => doc.data());

      const extraSnapshot = await db.collection('daily_extra_pages').where('site_id', '==', siteId).get();
      const extraPagesData = extraSnapshot.docs.map(doc => doc.data());

      // Overall stats
      const totalFiles = scanningData.reduce((sum, d) => sum + (d.files || 0), 0);
      let totalPages = scanningData.reduce((sum, d) => sum + (d.pages || 0), 0);
      
      const overall = {
        total_files: totalFiles,
        total_pages: mode === 'main' ? (totalPages + extraPagesData.reduce((sum, d) => sum + (d.extra_pages || 0), 0)) : totalPages,
        target_files: site?.target_files || 0
      };

      // Monthly stats
      const monthlyMap = new Map();
      scanningData.forEach(d => {
        const month = d.date.substring(0, 7); // YYYY-MM
        if (!monthlyMap.has(month)) {
          monthlyMap.set(month, { month, files: 0, personal_pages: 0, extra_pages: 0 });
        }
        const m = monthlyMap.get(month);
        m.files += (d.files || 0);
        m.personal_pages += (d.pages || 0);
      });

      extraPagesData.forEach(d => {
        const month = d.date.substring(0, 7);
        if (monthlyMap.has(month)) {
          monthlyMap.get(month).extra_pages += (d.extra_pages || 0);
        } else {
          monthlyMap.set(month, { month, files: 0, personal_pages: 0, extra_pages: d.extra_pages || 0 });
        }
      });

      const formattedMonthly = Array.from(monthlyMap.values())
        .map(m => ({
          month: m.month,
          files: m.files,
          pages: mode === 'main' ? (m.personal_pages + m.extra_pages) : m.personal_pages,
          extra_pages: m.extra_pages
        }))
        .sort((a, b) => b.month.localeCompare(a.month));

      // Weekly stats
      const weeklyMap = new Map();
      scanningData.forEach(d => {
        if (!weeklyMap.has(d.date)) {
          weeklyMap.set(d.date, { date: d.date, files: 0, pages: 0 });
        }
        const w = weeklyMap.get(d.date);
        w.files += (d.files || 0);
        w.pages += (d.pages || 0);
      });

      if (mode === 'main') {
        extraPagesData.forEach(d => {
          if (weeklyMap.has(d.date)) {
            weeklyMap.get(d.date).pages += (d.extra_pages || 0);
          } else {
            weeklyMap.set(d.date, { date: d.date, files: 0, pages: d.extra_pages || 0 });
          }
        });
      }

      const weekly = Array.from(weeklyMap.values())
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 30);

      const result = { overall, monthly: formattedMonthly, weekly, mode };
      setCache(cacheKey, result);
      res.json(result);
    } catch (err) {
      console.error('[STATS] Error:', err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/export/:siteId", requireAuth, async (req: any, res) => {
    const siteId = req.params.siteId;
    if (!checkSiteAccess(req.user, siteId, 'admin-reports')) {
      return res.status(403).json({ error: "Access denied" });
    }
    const monthStr = req.query.month as string || format(new Date(), 'yyyy-MM');
    const mode = (req.query.mode as string) || 'personal'; // 'personal' or 'main'
    
    try {
      const siteDoc = await db.collection('sites').doc(siteId).get();
      if (!siteDoc.exists) return res.status(404).json({ error: "Site not found" });
      const site = siteDoc.data();

      const employeesSnapshot = await db.collection('employees').where('site_id', '==', siteId).get();
      const employees = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

      const startDate = startOfMonth(parseISO(monthStr + "-01"));
      const endDate = endOfMonth(startDate);
      const days = eachDayOfInterval({ start: startDate, end: endDate });

      const scanningSnapshot = await db.collection('scanning_data')
        .where('site_id', '==', siteId)
        .where('date', '>=', monthStr + "-01")
        .where('date', '<=', monthStr + "-31")
        .get();
      const scanningData = scanningSnapshot.docs.map(doc => doc.data());

      const extraSnapshot = await db.collection('daily_extra_pages')
        .where('site_id', '==', siteId)
        .where('date', '>=', monthStr + "-01")
        .where('date', '<=', monthStr + "-31")
        .get();
      const extraPagesData = extraSnapshot.docs.map(doc => doc.data());

    // Build the grid
    const aoa: any[][] = [];

    // Summary Table at the top
    aoa.push(["NAME", "FILES", "PAGES"]);
    let grandTotalFiles = 0;
    let grandTotalPages = 0;
    
      employees.forEach(e => {
        const eFiles = scanningData.filter(d => d.employee_id === e.id).reduce((sum, d) => sum + (d.files || 0), 0);
        let ePages = scanningData.filter(d => d.employee_id === e.id).reduce((sum, d) => sum + (d.pages || 0), 0);
        
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
        const total = scanningData.filter(d => d.employee_id === e.id).reduce((sum, d) => sum + (d.files || 0), 0);
        totalFilesRow.push("TOTAL FILES", total);
      });
      aoa.push(totalFilesRow);

      // Row 4: Total Pages per operator
      const totalPagesRow: any[] = ["", "", ""];
      employees.forEach(e => {
        let total = scanningData.filter(d => d.employee_id === e.id).reduce((sum, d) => sum + (d.pages || 0), 0);
        if (mode === 'main') {
          extraPagesData.forEach(ep => {
            const activeOnThisDay = scanningData.filter(d => d.date === ep.date);
            const activeIds = activeOnThisDay.map(d => d.employee_id);
            const isWorkingThisDay = activeIds.includes(e.id);
            if (isWorkingThisDay) {
              total += getDeterministicSplit(ep.extra_pages, e.id, activeIds, ep.date);
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
        
        const totalFiles = dayData.reduce((sum, d) => sum + (d.files || 0), 0);
        let totalPages = dayData.reduce((sum, d) => sum + (d.pages || 0), 0);
        if (mode === 'main') totalPages += extraForDay;
        
        row.push(totalFiles || 0, totalPages || 0);

        if (isSunday(day)) {
          employees.forEach(() => {
            row.push("SUNDAY", "SUNDAY");
          });
        } else {
          employees.forEach(e => {
            const empData = dayData.find(sd => sd.employee_id === e.id);
            let p = empData?.pages || 0;
            if (mode === 'main' && empData) {
              const activeIds = dayData.map(sd => sd.employee_id);
              p += getDeterministicSplit(extraForDay, e.id, activeIds, dateStr);
            }
            row.push(empData?.files || 0, p);
          });
        }
        aoa.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Scanning Data");

      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      const filename = `${monthStr}, ${site?.name}, ${mode}.xlsx`;
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(buf);
    } catch (err) {
      console.error('[EXPORT] Error:', err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/sites/:id", requireAuth, async (req: any, res) => {
    if (!checkSiteAccess(req.user, req.params.id, 'admin-sites')) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { id } = req.params;
    try {
      // Delete scanning data for all employees of this site
      const employeesSnapshot = await db.collection('employees').where('site_id', '==', id).get();
      const employeeIds = employeesSnapshot.docs.map(doc => doc.id);
      
      const batch = db.batch();
      
      // Delete scanning data
      for (const empId of employeeIds) {
        const sdSnapshot = await db.collection('scanning_data').where('employee_id', '==', empId).get();
        sdSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      }
      
      // Delete extra pages
      const extraSnapshot = await db.collection('daily_extra_pages').where('site_id', '==', id).get();
      extraSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      
      // Delete employees
      employeesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      
      // Delete site
      batch.delete(db.collection('sites').doc(id));
      
      await batch.commit();
      res.json({ success: true });
    } catch (error) {
      console.error("Site delete error:", error);
      res.status(500).json({ error: "Failed to delete site" });
    }
  });

  app.patch("/api/sites/:id", requireAuth, async (req: any, res) => {
    if (!checkSiteAccess(req.user, req.params.id, 'admin-sites')) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { target_files } = req.body;
    try {
      await db.collection('sites').doc(req.params.id).update({
        target_files: Number(target_files),
        updated_at: FieldValue.serverTimestamp()
      });
      res.json({ success: true });
    } catch (err) {
      console.error("Site update error:", err);
      res.status(500).json({ error: "Failed to update site" });
    }
  });

  app.post("/api/sites", requireAuth, async (req: any, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { name, target_files } = req.body;
    
    if (!name || typeof name !== 'string' || name.length < 2 || name.length > 50) {
      return res.status(400).json({ error: "Site name must be between 2 and 50 characters" });
    }

    try {
      const docRef = await db.collection('sites').add({
        name,
        target_files: target_files || 0,
        created_at: FieldValue.serverTimestamp()
      });
      res.json({ id: docRef.id, name, target_files });
    } catch (err) {
      console.error("Site create error:", err);
      res.status(500).json({ error: "Failed to create site" });
    }
  });

  app.post("/api/employees", requireAuth, async (req: any, res) => {
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

    try {
      const docRef = await db.collection('employees').add({
        name,
        site_id: String(site_id),
        is_active: true,
        created_at: FieldValue.serverTimestamp()
      });
      res.json({ id: docRef.id, name, site_id });
    } catch (err) {
      console.error("Employee create error:", err);
      res.status(500).json({ error: "Failed to create employee" });
    }
  });

  app.delete("/api/employees/:id", requireAuth, async (req: any, res) => {
    const { id } = req.params;
    console.log(`Deactivating employee ${id}`);
    try {
      const employeeRef = db.collection('employees').doc(id);
      const employeeDoc = await employeeRef.get();
      
      if (!employeeDoc.exists) {
        return res.status(404).json({ error: "Employee not found" });
      }
      
      const employee = employeeDoc.data();
      if (!checkSiteAccess(req.user, employee?.site_id, 'admin-operators')) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await employeeRef.update({
        is_active: false,
        updated_at: FieldValue.serverTimestamp()
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Deactivation error:", error);
      res.status(500).json({ error: "Failed to deactivate employee" });
    }
  });

  app.get("/api/all-operators", requireAuth, async (req: any, res) => {
    try {
      const sitesSnapshot = await db.collection('sites').get();
      const accessibleSiteIds = req.user.role === 'admin' 
        ? sitesSnapshot.docs.map(doc => doc.id)
        : (Array.isArray(req.user.site_access) ? req.user.site_access.map(String) : []);

      if (accessibleSiteIds.length === 0 && req.user.role !== 'admin' && !req.user.employee_id) return res.json([]);

      let employeesQuery: Query = db.collection('employees').where('is_active', '==', true);

      if (req.user.role !== 'admin') {
        if (req.user.employee_id) {
          employeesQuery = employeesQuery.where(FieldPath.documentId(), '==', String(req.user.employee_id));
        } else if (accessibleSiteIds.length > 0) {
          // Firestore 'in' query has a limit of 10 items, but let's assume it's fine for now or handle it
          if (accessibleSiteIds.length <= 10) {
            employeesQuery = employeesQuery.where('site_id', 'in', accessibleSiteIds);
          } else {
            // Fallback: fetch all and filter in memory if too many sites
            // For simplicity, we'll just use the first 10 or fetch all active
          }
        } else {
          return res.json([]);
        }
      }

      const employeesSnapshot = await employeesQuery.get();
      const employees = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

      // Join with site names in memory
      const sitesMap = new Map();
      sitesSnapshot.docs.forEach(doc => sitesMap.set(doc.id, doc.data().name));

      const operators = employees.map((e: any) => ({
        ...e,
        site_name: sitesMap.get(e.site_id) || 'Unknown'
      })).sort((a, b) => {
        const siteComp = a.site_name.localeCompare(b.site_name);
        if (siteComp !== 0) return siteComp;
        return a.name.localeCompare(b.name);
      });

      res.json(operators);
    } catch (err) {
      console.error('[ALL-OPERATORS] Error:', err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/operator-summary/:id", requireAuth, async (req: any, res) => {
    const operatorId = req.params.id;
    
    // Security check: if user is linked to an employee, they can only see their own data
    if (req.user.role !== 'admin' && req.user.employee_id && req.user.employee_id != operatorId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    try {
      const employeeDoc = await db.collection('employees').doc(operatorId).get();
      if (!employeeDoc.exists) return res.status(404).json({ error: "Employee not found" });
      const employee = employeeDoc.data();

      if (!checkSiteAccess(req.user, employee?.site_id)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const scanningSnapshot = await db.collection('scanning_data').where('employee_id', '==', operatorId).get();
      const scanningData = scanningSnapshot.docs.map(doc => doc.data());

      const rate = employee?.rate_per_page || 0.30;
      const summaryMap = new Map();

      scanningData.forEach(d => {
        const month = d.date.substring(0, 7);
        if (!summaryMap.has(month)) {
          summaryMap.set(month, { month, total_files: 0, total_pages: 0, total_rs: 0 });
        }
        const s = summaryMap.get(month);
        s.total_files += (d.files || 0);
        s.total_pages += (d.pages || 0);
        s.total_rs += (d.pages || 0) * rate;
      });

      const summary = Array.from(summaryMap.values()).sort((a, b) => b.month.localeCompare(a.month));
      res.json(summary);
    } catch (err) {
      console.error('[OPERATOR-SUMMARY] Error:', err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/operator-daily/:id", requireAuth, async (req: any, res) => {
    const operatorId = req.params.id;
    const { month } = req.query;

    // Security check: if user is linked to an employee, they can only see their own data
    if (req.user.role !== 'admin' && req.user.employee_id && req.user.employee_id != operatorId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    try {
      const employeeDoc = await db.collection('employees').doc(operatorId).get();
      if (!employeeDoc.exists) return res.status(404).json({ error: "Employee not found" });
      const employee = employeeDoc.data();

      if (!checkSiteAccess(req.user, employee?.site_id)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const scanningSnapshot = await db.collection('scanning_data')
        .where('employee_id', '==', operatorId)
        .where('date', '>=', month + "-01")
        .where('date', '<=', month + "-31")
        .get();
      
      const rate = employee?.rate_per_page || 0.30;
      const daily = scanningSnapshot.docs.map(doc => {
        const d = doc.data();
        return {
          date: d.date,
          files: d.files,
          pages: d.pages,
          rs: (d.pages || 0) * rate
        };
      }).sort((a, b) => a.date.localeCompare(b.date));

      res.json(daily);
    } catch (err) {
      console.error('[OPERATOR-DAILY] Error:', err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/employees/:id/rate", requireAuth, async (req: any, res) => {
    const { rate } = req.body;
    try {
      const employeeRef = db.collection('employees').doc(req.params.id);
      const employeeDoc = await employeeRef.get();
      
      if (!employeeDoc.exists) return res.status(404).json({ error: "Employee not found" });
      const employee = employeeDoc.data();

      if (!checkSiteAccess(req.user, employee?.site_id, 'admin-operators')) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await employeeRef.update({
        rate_per_page: Number(rate),
        updated_at: FieldValue.serverTimestamp()
      });
      res.json({ success: true });
    } catch (err) {
      console.error('[EMPLOYEE-RATE] Error:', err);
      res.status(500).json({ error: "Internal server error" });
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