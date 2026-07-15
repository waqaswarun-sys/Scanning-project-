import React, { useState, useEffect } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { ScanningData, MouzaEntry } from '../types';
import { 
  Sparkles, 
  Check, 
  X, 
  Loader2, 
  FileSpreadsheet, 
  LogOut, 
  AlertCircle,
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

export const GoogleSheetsImporter: React.FC<GoogleSheetsImporterProps> = ({
  adminData,
  adminDate,
  selectedSiteId,
  sites,
  stats,
  onImportSuccess
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [spreadsheetInput, setSpreadsheetInput] = useState('');
  const [rangeInput, setRangeInput] = useState('Sheet1!A:E');
  const [isFetching, setIsFetching] = useState(false);
  const [feedback, setFeedback] = useState<Array<{ type: 'success' | 'warning' | 'info'; message: string }>>([]);
  const [showExplanation, setShowExplanation] = useState(false);

  // Monitor auth state on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Refresh token if already signed in
        try {
          // Force refresh of token
          const idTokenResult = await currentUser.getIdTokenResult(true);
          // Note: In some scenarios Google access tokens aren't directly exposed on standard refresh token calls
          // but for Google Auth popup, the credential contains the accessToken.
          // If we already have the token from the popup, we're good.
        } catch (e) {
          console.error("Token refresh error", e);
        }
      } else {
        setUser(null);
        setToken(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync / Load site-specific values whenever selectedSiteId changes
  useEffect(() => {
    const siteUrl = localStorage.getItem(`gs_spreadsheet_url_${selectedSiteId}`) || localStorage.getItem('gs_spreadsheet_url') || '';
    const siteRange = localStorage.getItem(`gs_spreadsheet_range_${selectedSiteId}`) || localStorage.getItem('gs_spreadsheet_range') || 'Sheet1!A:E';
    setSpreadsheetInput(siteUrl);
    setRangeInput(siteRange);
    setFeedback([]); // Clear feedback logs when switching sites
  }, [selectedSiteId]);

  // Save spreadsheet parameters to localStorage on change for the specific site
  useEffect(() => {
    if (spreadsheetInput) {
      localStorage.setItem(`gs_spreadsheet_url_${selectedSiteId}`, spreadsheetInput);
      // Keep standard fallback as well
      localStorage.setItem('gs_spreadsheet_url', spreadsheetInput);
    }
  }, [spreadsheetInput, selectedSiteId]);

  useEffect(() => {
    if (rangeInput) {
      localStorage.setItem(`gs_spreadsheet_range_${selectedSiteId}`, rangeInput);
      // Keep standard fallback as well
      localStorage.setItem('gs_spreadsheet_range', rangeInput);
    }
  }, [rangeInput, selectedSiteId]);

  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    setFeedback([]);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = (result as any)._tokenResponse?.oauthAccessToken || 
                         (result as any).credential?.accessToken;
      
      if (!credential) {
        throw new Error('Google OAuth Access Token was not returned by Google login popup.');
      }
      setToken(credential);
      setUser(result.user);
      setFeedback([{ type: 'success', message: `Connected as ${result.user.email}!` }]);
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      setFeedback([{ 
        type: 'warning', 
        message: `Authentication failed: ${error.message || 'Please check popup permissions.'}` 
      }]);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setToken(null);
      setFeedback([{ type: 'info', message: 'Signed out from Google.' }]);
    } catch (e: any) {
      console.error('Google Sign-Out Error:', e);
    }
  };

  const extractSpreadsheetId = (input: string): string => {
    const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : input.trim();
  };

  // Fuzzy match score (reproduced same algorithm as WhatsApp parser for consistency)
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
      if (targetWords.some(tw => tw.includes(sw) || sw.includes(tw))) {
        matchedCount++;
      }
    });

    return Math.round((matchedCount / Math.max(sourceWords.length, targetWords.length)) * 80);
  };

  // Standardize dates to check if they match adminDate (YYYY-MM-DD)
  const parseAndCompareDate = (rawDate: string, targetDate: string): boolean => {
    if (!rawDate) return false;
    const cleanRaw = rawDate.trim().replace(/[\/\.]/g, '-'); // replace slashes/dots with dashes
    
    // YYYY-MM-DD matching
    if (cleanRaw === targetDate) return true;
    
    // Handle DD-MM-YYYY or DD-MM-YY or MM-DD-YYYY
    const parts = cleanRaw.split('-');
    if (parts.length === 3) {
      const targetParts = targetDate.split('-'); // [YYYY, MM, DD]
      
      // Match parts: standard check
      const d1 = parts[0].padStart(2, '0');
      const d2 = parts[1].padStart(2, '0');
      const d3 = parts[2];

      const tYYYY = targetParts[0];
      const tMM = targetParts[1];
      const tDD = targetParts[2];

      // DD-MM-YYYY format
      if (d1 === tDD && d2 === tMM && (d3 === tYYYY || d3 === tYYYY.substring(2))) return true;
      // MM-DD-YYYY format
      if (d1 === tMM && d2 === tDD && (d3 === tYYYY || d3 === tYYYY.substring(2))) return true;
      // YYYY-MM-DD format
      if (d1 === tYYYY && d2 === tMM && d3 === tDD) return true;
    }
    return false;
  };

  const handleFetchAndFill = async () => {
    if (!spreadsheetInput.trim()) {
      setFeedback([{ type: 'warning', message: 'Please provide a Google Spreadsheet URL or ID.' }]);
      return;
    }

    const spreadsheetId = extractSpreadsheetId(spreadsheetInput);
    const range = rangeInput.trim() || 'Sheet1!A:E';

    if (!token) {
      setFeedback([{ type: 'warning', message: 'Please connect your Google Account first.' }]);
      return;
    }

    setIsFetching(true);
    setFeedback([]);

    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.error?.message || `HTTP error ${response.status}`;
        if (response.status === 401) {
          throw new Error('Unauthorized or expired Google session. Please sign in again.');
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      const rows: string[][] = data.values;

      if (!rows || rows.length === 0) {
        setFeedback([{ type: 'warning', message: 'The spreadsheet is empty or could not be read.' }]);
        return;
      }

      // Check header columns
      const headers = rows[0].map(h => (h || '').trim().toLowerCase());
      
      // Attempt to locate important column indexes
      let operatorIdx = -1;
      let filesIdx = -1;
      let pagesIdx = -1;
      let mouzasIdx = -1;
      let dateIdx = -1;

      headers.forEach((h, i) => {
        if (/operator|name|employee|worker|member|person/i.test(h)) {
          if (operatorIdx === -1) operatorIdx = i;
        } else if (/file|volume|register|reg|unit|count/i.test(h)) {
          if (filesIdx === -1) filesIdx = i;
        } else if (/page|pages|pge/i.test(h)) {
          if (pagesIdx === -1) pagesIdx = i;
        } else if (/mouza|mouzas|area|location/i.test(h)) {
          if (mouzasIdx === -1) mouzasIdx = i;
        } else if (/date|day|time/i.test(h)) {
          if (dateIdx === -1) dateIdx = i;
        }
      });

      // Fallback column indexing if headers aren't detected
      if (operatorIdx === -1) operatorIdx = 0; // default col 1
      if (filesIdx === -1) filesIdx = 1; // default col 2
      if (pagesIdx === -1) pagesIdx = 2; // default col 3
      if (mouzasIdx === -1 && headers.length > 3) mouzasIdx = 3; // default col 4
      if (dateIdx === -1 && headers.length > 4) dateIdx = 4; // default col 5

      const importFeedback: Array<{ type: 'success' | 'warning' | 'info'; message: string }> = [];
      let updatedCount = 0;
      let skippedCount = 0;
      
      // Copy current form state to apply updates
      let newAdminData = [...adminData];

      // Parse spreadsheet rows (skip header row at index 0)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const rawName = row[operatorIdx] || '';
        const rawFiles = row[filesIdx] || '';
        const rawPages = row[pagesIdx] || '';
        const rawMouzas = mouzasIdx !== -1 ? row[mouzasIdx] || '' : '';
        const rawDate = dateIdx !== -1 ? row[dateIdx] || '' : '';

        if (!rawName.trim()) continue;

        // Verify date filter if column exists
        if (dateIdx !== -1 && rawDate.trim()) {
          const isMatch = parseAndCompareDate(rawDate, adminDate);
          if (!isMatch) {
            skippedCount++;
            continue; // Skip because date doesn't match current selected adminDate
          }
        }

        // Parse numbers safely
        const filesNum = parseInt(rawFiles.replace(/,/g, '').trim(), 10);
        const pagesNum = parseInt(rawPages.replace(/,/g, '').trim(), 10);
        
        const filesVal = isNaN(filesNum) ? null : filesNum;
        const pagesVal = isNaN(pagesNum) ? null : pagesNum;

        // Parse Mouzas if present
        let parsedMouzas: MouzaEntry[] | undefined = undefined;
        if (rawMouzas.trim()) {
          const mouzaNames = rawMouzas.split(',').map(m => m.trim()).filter(Boolean);
          parsedMouzas = mouzaNames.map(name => ({
            name,
            status: 'Complete',
            years: '',
            type: 'RHZ',
            quantity: 1
          }));
        }

        // Fuzzy match operator name
        let bestOperator: any = null;
        let bestScore = 0;

        adminData.forEach(op => {
          const score = getMatchScore(op.name, rawName);
          if (score > bestScore) {
            bestScore = score;
            bestOperator = op;
          }
        });

        if (bestOperator && bestScore >= 40) {
          // Update operator record
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
          let fileLabel = (stats?.overall?.unit) || (sites.find(s => s.id === selectedSiteId) as any)?.unit || 'Files';
          importFeedback.push({
            type: 'success',
            message: `Row ${i + 1}: Matched "${bestOperator.name}" (${bestScore}% confidence) -> ${filesVal !== null ? `${filesVal} ${fileLabel}` : `no ${fileLabel}`}, ${pagesVal !== null ? `${pagesVal} Pages` : 'no Pages'}${parsedMouzas ? `, ${parsedMouzas.length} Mouzas` : ''}.`
          });
        } else {
          importFeedback.push({
            type: 'warning',
            message: `Row ${i + 1}: Could not find operator matching "${rawName}" (best match: ${bestOperator ? `"${bestOperator.name}" with ${bestScore}%` : 'none'}).`
          });
        }
      }

      if (updatedCount > 0) {
        onImportSuccess(newAdminData, importFeedback);
        setFeedback([
          { 
            type: 'success', 
            message: `Successfully imported entries from Google Sheet! Filled ${updatedCount} operators. ${skippedCount > 0 ? `(Skipped ${skippedCount} entries for other dates)` : ''}` 
          }
        ]);
      } else {
        setFeedback([
          { 
            type: 'warning', 
            message: `Fetched sheet successfully, but did not match any entries for the selected date (${adminDate}).` 
          },
          ...importFeedback
        ]);
      }

    } catch (err: any) {
      console.error('[SHEETS_IMPORT_ERROR]', err);
      setFeedback([{ 
        type: 'warning', 
        message: `Failed to import Google Sheet: ${err.message || 'Check URL permissions and Range configurations.'}` 
      }]);
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="mb-6 bg-slate-50 border border-slate-200/60 rounded-2xl p-5 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
          <h4 className="text-sm font-bold text-slate-800">
            Google Sheets Auto-Importer
          </h4>
          <span className="text-[9px] bg-emerald-100 text-emerald-700 font-extrabold px-2 py-0.5 rounded-full uppercase shrink-0 animate-pulse">
            Automated
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowExplanation(!showExplanation)}
            className="text-xs text-slate-500 hover:text-indigo-600 font-bold flex items-center gap-1 cursor-pointer focus:outline-none"
          >
            <HelpCircle className="w-4 h-4" />
            <span>How to use</span>
          </button>

          {user && (
            <button
              type="button"
              onClick={handleGoogleSignOut}
              className="text-xs text-slate-500 hover:text-red-500 font-bold flex items-center gap-1 cursor-pointer focus:outline-none ml-2"
              title="Disconnect Google Account"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          )}
        </div>
      </div>

      {showExplanation && (
        <div className="mb-4 bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 text-xs text-slate-600 space-y-2">
          <p className="font-semibold text-emerald-800">How to setup your Google Sheet:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Create a spreadsheet with headers in the first row.</li>
            <li>Your headers should contain: <code className="bg-white px-1.5 py-0.5 rounded border">Operator</code>, <code className="bg-white px-1.5 py-0.5 rounded border">Files</code>, <code className="bg-white px-1.5 py-0.5 rounded border">Pages</code>, <code className="bg-white px-1.5 py-0.5 rounded border">Date</code> (optional), and <code className="bg-white px-1.5 py-0.5 rounded border">Mouzas</code> (optional).</li>
            <li>If you have a <code className="bg-white px-1.5 py-0.5 rounded border">Date</code> column, the importer will filter rows matching today's selected date (<span className="font-bold font-mono">{adminDate}</span>).</li>
            <li>If no Date column is found, all rows will be imported for the selected date.</li>
            <li>Make sure your sheet is accessible to you or anyone with the link!</li>
          </ul>
        </div>
      )}

      {!user ? (
        <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-slate-200 bg-white rounded-xl space-y-3">
          <p className="text-xs text-slate-500 font-medium text-center max-w-sm">
            To fetch spreadsheet data directly from your Google Sheets, securely authorize the app by clicking below.
          </p>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoggingIn}
            className="gsi-material-button hover:shadow-md transition-all cursor-pointer"
            id="gsi-login-sheets"
          >
            <div className="gsi-material-button-state"></div>
            <div className="gsi-material-button-content-wrapper">
              <div className="gsi-material-button-icon">
                {isLoggingIn ? (
                  <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                ) : (
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                )}
              </div>
              <span className="gsi-material-button-contents text-xs">
                {isLoggingIn ? 'Connecting...' : 'Connect to Google Account'}
              </span>
            </div>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-3">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Google Sheet URL or Spreadsheet ID
              </label>
              <input
                type="text"
                value={spreadsheetInput}
                onChange={(e) => setSpreadsheetInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/... /edit"
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
              />
            </div>
            
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Sheet Name & Range
              </label>
              <input
                type="text"
                value={rangeInput}
                onChange={(e) => setRangeInput(e.target.value)}
                placeholder="Sheet1!A:E"
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleFetchAndFill}
              disabled={isFetching}
              className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-md shadow-emerald-600/10 cursor-pointer focus:outline-none"
            >
              {isFetching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Fetching Spreadsheet...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Fetch & Auto-Fill Form</span>
                </>
              )}
            </button>
            
            <div className="text-[11px] text-slate-400 font-medium">
              Connected as <span className="text-slate-600 font-bold">{user.email}</span>
            </div>
          </div>
        </div>
      )}

      {/* Import Feedback / Parsing Logs */}
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

// Simple utility function for dynamic tailwind classes
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
