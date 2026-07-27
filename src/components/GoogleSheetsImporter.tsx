import React, { useState, useEffect } from 'react';
import { ScanningData, MouzaEntry } from '../types';
import {
  Check,
  Loader2,
  FileSpreadsheet,
  HelpCircle
} from 'lucide-react';

interface GoogleSheetsImporterProps {
  adminData: ScanningData[];
  adminDate: string;
  selectedSiteId: string | number;
  sites: any[];
  stats: any;
  onImportSuccess: (updatedData: ScanningData[], feedback: Array<{ type: 'success' | 'warning' | 'info'; message: string }>) => void;
}

// Minimal RFC-4180 CSV parser: handles quoted fields, escaped quotes ("")
// and commas / newlines inside quotes (e.g. "Kotha utera,Dera jand").
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* ignore */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

export const GoogleSheetsImporter: React.FC<GoogleSheetsImporterProps> = ({
  adminData,
  adminDate,
  selectedSiteId,
  sites,
  stats,
  onImportSuccess
}) => {
  const [sheetInput, setSheetInput] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [feedback, setFeedback] = useState<Array<{ type: 'success' | 'warning' | 'info'; message: string }>>([]);
  const [showExplanation, setShowExplanation] = useState(false);

  // Load the per-site published-sheet link when the selected site changes.
  useEffect(() => {
    const saved = localStorage.getItem(`gs_pub_url_${selectedSiteId}`) || '';
    setSheetInput(saved);
    setFeedback([]);
  }, [selectedSiteId]);

  // Remember the link per site.
  useEffect(() => {
    if (sheetInput) localStorage.setItem(`gs_pub_url_${selectedSiteId}`, sheetInput);
  }, [sheetInput, selectedSiteId]);

  // Fuzzy match score for operator names.
  const getMatchScore = (source: string, target: string): number => {
    const s = source.toLowerCase().trim();
    const t = target.toLowerCase().trim();
    if (s === t) return 100;
    if (t.includes(s) || s.includes(t)) return 90;
    const sourceWords = s.split(/\s+/).filter(w => w.length > 1);
    const targetWords = t.split(/\s+/).filter(w => w.length > 1);
    if (sourceWords.length === 0 || targetWords.length === 0) return 0;
    let matchedCount = 0;
    sourceWords.forEach(sw => {
      if (targetWords.some(tw => tw.includes(sw) || sw.includes(tw))) matchedCount++;
    });
    return Math.round((matchedCount / Math.max(sourceWords.length, targetWords.length)) * 80);
  };

  // Compare a raw sheet date (formatted string OR a spreadsheet serial number)
  // against the selected adminDate (YYYY-MM-DD). Dates are month-first (M/D/YYYY).
  const parseAndCompareDate = (rawDate: string, targetDate: string): boolean => {
    if (!rawDate) return false;
    const raw = rawDate.trim();

    // Spreadsheet serial number (e.g. 46216 or 46216.0) -> calendar date.
    const numeric = Number(raw);
    if (!isNaN(numeric) && /^\d+(\.\d+)?$/.test(raw) && numeric > 30000 && numeric < 90000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(numeric) * 86400000);
      return d.toISOString().slice(0, 10) === targetDate;
    }

    // Strip any time part, then split into 3 numeric pieces.
    const datePart = raw.split(/[ T]/)[0];
    const p = datePart.split(/[\/.\-]/).map(x => x.trim()).filter(Boolean);
    if (p.length !== 3) return datePart === targetDate;

    let y: string, m: string, d: string;
    if (p[0].length === 4) {
      // YYYY-MM-DD
      [y, m, d] = p;
    } else {
      y = p[2].length === 2 ? '20' + p[2] : p[2];
      const a = parseInt(p[0], 10);
      const b = parseInt(p[1], 10);
      if (a > 12) { d = String(a); m = String(b); }   // clearly Day/Month
      else { m = String(a); d = String(b); }           // Month/Day (your format)
    }
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return iso === targetDate;
  };

  const handleFetchAndFill = async () => {
    if (!sheetInput.trim()) {
      setFeedback([{ type: 'warning', message: 'Please paste the published Google Sheet link for this site.' }]);
      return;
    }

    setIsFetching(true);
    setFeedback([]);

    try {
      const authToken = localStorage.getItem('authToken');
      const resp = await fetch(`/api/sheets/fetch-csv?url=${encodeURIComponent(sheetInput.trim())}`, {
        headers: authToken ? { 'x-auth-token': authToken } : {},
        credentials: 'include',
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Server error ${resp.status}`);
      }

      const csvText = await resp.text();
      const rows = parseCSV(csvText).filter(r => r.some(c => (c || '').trim() !== ''));
      if (rows.length < 2) {
        setFeedback([{ type: 'warning', message: 'The sheet appears to be empty.' }]);
        return;
      }

      const headers = rows[0].map(h => (h || '').trim().toLowerCase());

      // Detect columns. Order matters — a "date" column must NOT be mistaken
      // for the "Timestamp" column, and "Mouza Count" must not be read as files.
      let operatorIdx = -1, filesIdx = -1, pagesIdx = -1, mouzasIdx = -1, dateIdx = -1;
      headers.forEach((h, i) => {
        const isTimestamp = /time\s*stamp|timestamp/.test(h);
        if (/operator|name|employee|worker|member|person/.test(h) && operatorIdx === -1 && !/mouza/.test(h)) operatorIdx = i;
        else if (/register|file|volume|\breg\b|unit/.test(h) && filesIdx === -1) filesIdx = i;
        else if (/page|pge/.test(h) && pagesIdx === -1) pagesIdx = i;
        else if (/mouza|area|location/.test(h) && !/count/.test(h) && mouzasIdx === -1) mouzasIdx = i;
        else if (/date/.test(h) && !isTimestamp && dateIdx === -1) dateIdx = i;
      });

      // Sensible fallbacks if headers are missing.
      if (operatorIdx === -1) operatorIdx = 0;
      if (filesIdx === -1) filesIdx = 1;
      if (pagesIdx === -1) pagesIdx = 2;

      const importFeedback: Array<{ type: 'success' | 'warning' | 'info'; message: string }> = [];
      let updatedCount = 0;
      let skippedCount = 0;
      let newAdminData = [...adminData];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const rawName = (row[operatorIdx] || '').trim();
        const rawFiles = row[filesIdx] || '';
        const rawPages = row[pagesIdx] || '';
        const rawMouzas = mouzasIdx !== -1 ? (row[mouzasIdx] || '') : '';
        const rawDate = dateIdx !== -1 ? (row[dateIdx] || '') : '';

        if (!rawName) continue;

        // Only keep rows for the date selected on the entry page.
        if (dateIdx !== -1 && rawDate.trim()) {
          if (!parseAndCompareDate(rawDate, adminDate)) { skippedCount++; continue; }
        }

        const filesNum = parseInt(String(rawFiles).replace(/,/g, '').trim(), 10);
        const pagesNum = parseInt(String(rawPages).replace(/,/g, '').trim(), 10);
        const filesVal = isNaN(filesNum) ? null : filesNum;
        const pagesVal = isNaN(pagesNum) ? null : pagesNum;

        let parsedMouzas: MouzaEntry[] | undefined = undefined;
        if (rawMouzas.trim()) {
          const mouzaNames = rawMouzas.split(/[/,;\n]+/).map(m => m.trim()).filter(Boolean);
          if (mouzaNames.length) {
            parsedMouzas = mouzaNames.map(name => ({
              name, status: 'Complete', years: '', type: 'RHZ', quantity: 1
            }));
          }
        }

        let bestOperator: any = null;
        let bestScore = 0;
        adminData.forEach(op => {
          const score = getMatchScore(op.name, rawName);
          if (score > bestScore) { bestScore = score; bestOperator = op; }
        });

        if (bestOperator && bestScore >= 40) {
          newAdminData = newAdminData.map(item => {
            if (item.employee_id === bestOperator.employee_id) {
              return {
                ...item,
                files: filesVal !== null ? filesVal : item.files,
                pages: pagesVal !== null ? pagesVal : item.pages,
                ...(parsedMouzas ? { mouzas: parsedMouzas } : {})
              };
            }
            return item;
          });
          updatedCount++;
          const fileLabel = (stats?.overall?.unit) || (sites.find(s => s.id === selectedSiteId) as any)?.unit || 'Files';
          importFeedback.push({
            type: 'success',
            message: `Matched "${bestOperator.name}" (${bestScore}%) -> ${filesVal !== null ? `${filesVal} ${fileLabel}` : `no ${fileLabel}`}, ${pagesVal !== null ? `${pagesVal} Pages` : 'no Pages'}${parsedMouzas ? `, ${parsedMouzas.length} Mouzas` : ''}.`
          });
        } else {
          importFeedback.push({
            type: 'warning',
            message: `No operator match for "${rawName}"${bestOperator ? ` (closest: "${bestOperator.name}" ${bestScore}%)` : ''}.`
          });
        }
      }

      if (updatedCount > 0) {
        onImportSuccess(newAdminData, importFeedback);
        setFeedback([{
          type: 'success',
          message: `Filled ${updatedCount} operator(s) for ${adminDate}.${skippedCount > 0 ? ` (Ignored ${skippedCount} rows for other dates.)` : ''} Review the values, then Save.`
        }, ...importFeedback]);
      } else {
        setFeedback([{
          type: 'warning',
          message: `Fetched the sheet, but found no matching rows for ${adminDate}.`
        }, ...importFeedback]);
      }
    } catch (err: any) {
      console.error('[SHEETS_IMPORT_ERROR]', err);
      setFeedback([{ type: 'warning', message: `Import failed: ${err.message || 'Please check the link and try again.'}` }]);
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="mb-6 bg-slate-50 border border-slate-200/60 rounded-2xl p-5 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
          <h4 className="text-sm font-bold text-slate-800">Google Sheets Auto-Importer</h4>
          <span className="text-[9px] bg-emerald-100 text-emerald-700 font-extrabold px-2 py-0.5 rounded-full uppercase shrink-0">Public link</span>
        </div>
        <button
          type="button"
          onClick={() => setShowExplanation(!showExplanation)}
          className="text-xs text-slate-500 hover:text-indigo-600 font-bold flex items-center gap-1 cursor-pointer focus:outline-none"
        >
          <HelpCircle className="w-4 h-4" />
          <span>How to use</span>
        </button>
      </div>

      {showExplanation && (
        <div className="mb-4 bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 text-xs text-slate-600 space-y-2">
          <p className="font-semibold text-emerald-800">One-time setup for each site:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>In Google Sheets: <b>File → Share → Publish to web</b>.</li>
            <li>Choose the responses tab, then pick <b>Comma-separated values (.csv)</b> and click Publish.</li>
            <li>Copy the link it gives you and paste it in the box below. It is saved for this site.</li>
            <li>Then just pick the date above and click <b>Fetch &amp; Auto-Fill</b>. Only that date's rows are used (currently <span className="font-bold font-mono">{adminDate}</span>).</li>
            <li>The importer reads the <b>DATE</b>, operator <b>NAME</b>, <b>REGISTERS</b>, <b>PAGES</b> and <b>MOUZA</b> columns automatically.</li>
          </ul>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Published Google Sheet link (CSV) for this site
          </label>
          <input
            type="text"
            value={sheetInput}
            onChange={(e) => setSheetInput(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleFetchAndFill}
            disabled={isFetching}
            className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-md shadow-emerald-600/10 cursor-pointer focus:outline-none"
          >
            {isFetching ? (
              <><Loader2 className="w-4 h-4 animate-spin" /><span>Fetching…</span></>
            ) : (
              <><FileSpreadsheet className="w-4 h-4" /><span>Fetch &amp; Auto-Fill for {adminDate}</span></>
            )}
          </button>
        </div>
      </div>

      {feedback.length > 0 && (
        <div className="mt-4 bg-white border border-slate-200/50 rounded-xl p-4 max-h-[200px] overflow-y-auto space-y-2 shadow-inner">
          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Import logs</h5>
          <div className="space-y-1.5">
            {feedback.map((fb, i) => (
              <div
                key={i}
                className={cn(
                  "text-xs p-2 rounded flex items-start gap-2 font-medium border leading-relaxed",
                  fb.type === 'success' && "bg-emerald-50/50 text-emerald-800 border-emerald-100",
                  fb.type === 'warning' && "bg-amber-50/50 text-amber-800 border-amber-100",
                  fb.type === 'info' && "bg-slate-50 text-slate-800 border-slate-100"
                )}
              >
                <span className="mt-0.5 text-sm shrink-0">
                  {fb.type === 'success' && "✅"}
                  {fb.type === 'warning' && "⚠️"}
                  {fb.type === 'info' && "ℹ️"}
                </span>
                <span>{fb.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
