import React, { useState, useEffect, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import { 
  LayoutDashboard, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Plus, 
  Save,
  Trash2,
  Settings,
  Calendar as CalendarIcon,
  TrendingUp,
  Users,
  FileText,
  Layers,
  Copy,
  Check,
  LogOut,
  UserCog,
  User,
  Menu,
  X,
  ChevronDown,
  Globe,
  Edit,
  Map,
  Search,
  RotateCcw
} from 'lucide-react';
import UserControlsPage from './components/UserControlsPage';
import AppsPage from './components/AppsPage';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfWeek, addDays, subWeeks, addWeeks, isSameDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  Cell
} from 'recharts';
import { cn } from './lib/utils';
import { Site, Employee, ScanningData, Stats, MouzaEntry } from './types';
import { LoginPage } from './components/LoginPage';

// --- Components ---

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("bg-white rounded-2xl border border-black/5 shadow-sm p-6", className)}>
    {children}
  </div>
);

const StatCard = ({ title, value, icon: Icon, colorClass, loading }: { title: string; value: string | number; icon: any; colorClass: string; loading?: boolean }) => (
  <Card className="flex items-center gap-2 md:gap-4 p-3 md:p-6">
    <div className={cn("p-2 md:p-3 rounded-xl shrink-0", colorClass)}>
      <Icon className="w-4 h-4 md:w-6 md:h-6 text-white" />
    </div>
    <div className="min-w-0">
      <p className="text-[9px] md:text-sm font-medium text-slate-500 uppercase tracking-wider truncate">{title}</p>
      {loading ? (
        <div className="h-6 md:h-8 w-16 md:w-24 bg-slate-100 animate-pulse rounded-lg mt-1" />
      ) : (
        <h3 className="text-lg md:text-2xl font-bold text-slate-900">{value}</h3>
      )}
    </div>
  </Card>
);

// --- Main App ---

export default function App() {
  const [view, setView] = useState<
    'main-view' | 
    'personal-records' | 
    'admin-data-entry' | 
    'admin-management' | 
    'admin-reports' | 
    'admin-sites' |
    'admin-operators' |
    'user-controls' |
    'operator-summary' |
    'mouza-details' |
    'apps'
  >('main-view');
  const [sites, setSites] = useState<Site[]>([]);
  const [sitesSummary, setSitesSummary] = useState<any[]>([]);
  const [operatorsSummary, setOperatorsSummary] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | number | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Admin State
  const [adminDate, setAdminDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [adminData, setAdminData] = useState<ScanningData[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDownloading, setIsDownloading] = useState<'personal' | 'main' | null>(null);
  const [addEmployeeMessage, setAddEmployeeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [exportMonth, setExportMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [exportType, setExportType] = useState<'month' | 'range'>('month');
  const [exportStartDate, setExportStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [exportEndDate, setExportEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [operatorsMonth, setOperatorsMonth] = useState(format(new Date(), 'yyyy-MM'));

  // Company State
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Management State
  const [showManagement, setShowManagement] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteTarget, setNewSiteTarget] = useState('');
  const [newSiteRate, setNewSiteRate] = useState('0.3');
  const [newSiteUnit, setNewSiteUnit] = useState('Files');
  const [newSiteDefaultExtraPages, setNewSiteDefaultExtraPages] = useState('0');
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [updateTargetValue, setUpdateTargetValue] = useState('');
  const [updateMouzaValue, setUpdateMouzaValue] = useState('');
  const [confirmDeleteSite, setConfirmDeleteSite] = useState<string | number | null>(null);
  const [confirmDeleteEmployeeId, setConfirmDeleteEmployeeId] = useState<string | number | null>(null);
  const [copiedDate, setCopiedDate] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSiteOpen, setIsSiteOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Operator Summary State
  const [allOperators, setAllOperators] = useState<any[]>([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | number | null>(null);
  const [operatorSummary, setOperatorSummary] = useState<any[]>([]);
  const [operatorDaily, setOperatorDaily] = useState<any[]>([]);
  const [summaryMonth, setSummaryMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isUpdatingRate, setIsUpdatingRate] = useState<string | number | null>(null);
  const [newRateValue, setNewRateValue] = useState('');
  const [isUpdatingSiteRate, setIsUpdatingSiteRate] = useState<string | number | null>(null);
  const [newSiteRateValue, setNewSiteRateValue] = useState('');
  const [isUpdatingSiteUnit, setIsUpdatingSiteUnit] = useState<string | number | null>(null);
  const [newSiteUnitValue, setNewSiteUnitValue] = useState('');
  const [isUpdatingSiteDefaultEP, setIsUpdatingSiteDefaultEP] = useState<string | number | null>(null);
  const [newSiteDefaultEPValue, setNewSiteDefaultEPValue] = useState('');

  // Past Extra Pages Editor States
  const [editPastSiteId, setEditPastSiteId] = useState<string>('');
  const [editPastDate, setEditPastDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [editPastEPValue, setEditPastEPValue] = useState<string>('0');
  const [isSavingPastEP, setIsSavingPastEP] = useState<boolean>(false);
  const [isFetchingPastEP, setIsFetchingPastEP] = useState<boolean>(false);
  const [pastEPMessage, setPastEPMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Mouza Details State
  const [mouzasData, setMouzasData] = useState<any[]>([]);
  const [mouzasLoading, setMouzasLoading] = useState(false);
  const [mouzaSearch, setMouzaSearch] = useState('');
  const [selectedMouzaFilter, setSelectedMouzaFilter] = useState('all');
  const [updatingMouzaStatusName, setUpdatingMouzaStatusName] = useState<string | null>(null);

  // Wizard Data Entry State
  const [selectedOperatorIndex, setSelectedOperatorIndex] = useState<number>(0);
  const [showCompletionMessage, setShowCompletionMessage] = useState<boolean>(false);

  const apiFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('authToken');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const headers = {
      ...options.headers,
      'X-Auth-Token': token || '',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    
    try {
      const response = await fetch(url, { 
        ...options, 
        headers, 
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }, []);

  const checkAuth = useCallback(async (retryCount = 0) => {
    const token = localStorage.getItem('authToken');
    console.log(`[AUTH] Starting checkAuth (attempt ${retryCount + 1})... Token: ${token ? token.substring(0, 5) + '...' : 'none'}`);
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Auth check timeout')), 15000)
    );

    let shouldRetry = false;

    try {
      // Use a cache-buster to ensure we get fresh data from the server
      const res = await apiFetch(`/api/me?t=${Date.now()}&retry=${retryCount}`);
      
      console.log(`[AUTH] /api/me response status: ${res.status} (attempt ${retryCount + 1})`);
      
      if (res.ok) {
        const user = await res.json();
        console.log('[AUTH] /api/me success:', user?.username);
        if (user) {
          setIsAuthenticated(true);
          setCurrentUser(user);
          
          // Redirect if current view is not permitted
          const permissions = user.role === 'admin' ? ['main-view', 'user-controls', 'admin-operators', 'admin-sites', 'admin-management'] : (user.permissions || []);
          setView(currentView => {
            if (user.role !== 'admin') {
              // Dashboard first if assigned, else first available permission
              if (permissions.includes('main-view')) return 'main-view';
              if (permissions.includes('operator-summary')) return 'operator-summary';
              return permissions.length > 0 ? permissions[0] as any : 'main-view';
            }
            return currentView;
          });
        } else {
          console.log('[AUTH] No user in response body');
          if (token && retryCount < 2) shouldRetry = true;
        }
      } else {
        console.log(`[AUTH] /api/me failed with status ${res.status}`);
        if (res.status === 401) {
          if (token && retryCount < 2) {
            console.log('[AUTH] 401 but token exists, retrying...');
            shouldRetry = true;
          } else {
            console.log('[AUTH] 401 and no token or retries exhausted, clearing auth');
            localStorage.removeItem('authToken');
            setIsAuthenticated(false);
            setCurrentUser(null);
          }
        } else if (retryCount < 2) {
          shouldRetry = true;
        }
      }
    } catch (err) {
      console.error('[AUTH] Check failed:', err);
      if (retryCount < 2) {
        shouldRetry = true;
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    }

    if (shouldRetry) {
      const delay = 1000 * (retryCount + 1);
      console.log(`[AUTH] Retrying checkAuth in ${delay}ms...`);
      setTimeout(() => checkAuth(retryCount + 1), delay);
    } else {
      setAuthChecked(true);
    }
  }, [apiFetch]);

  useEffect(() => {
    console.log(`[APP] Mount. URL: ${window.location.href}`);
    console.log(`[APP] localStorage authToken: ${localStorage.getItem('authToken') ? 'present' : 'missing'}`);
    checkAuth();
  }, [checkAuth]);

  const hasPermission = (permission: string) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return currentUser.permissions?.includes(permission);
  };
  const handleLogout = useCallback(async () => {
    console.log('[AUTH] Initiating logout...');
    try {
      // Clear all storage to prevent stale data
      localStorage.clear();
      sessionStorage.clear();
      
      // Attempt to notify server
      await apiFetch('/api/logout', { method: 'POST' });
    } catch (err) {
      console.error('[AUTH] Logout API call failed:', err);
    } finally {
      // Force a full page reload with a cache-buster to ensure all states are reset
      window.location.href = window.location.origin + '/?logout=' + Date.now();
    }
  }, [apiFetch]);

  useEffect(() => {
    const handleLogoutTrigger = () => handleLogout();
    window.addEventListener('trigger-logout', handleLogoutTrigger);
    return () => window.removeEventListener('trigger-logout', handleLogoutTrigger);
  }, [handleLogout]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSites();
    }
  }, [isAuthenticated]);

  const currentMode = (view === 'main-view' || view === 'admin-reports') ? 'main' : 'personal';

  useEffect(() => {
    if (selectedSiteId) {
      setStats(null);
      fetchStats(currentMode);
    }
  }, [selectedSiteId, currentMode]);

  useEffect(() => {
    if (selectedSiteId && view.startsWith('admin')) {
      fetchAdminData();
    }
  }, [selectedSiteId, view, adminDate]);

  useEffect(() => {
    if (selectedSiteId && (view === 'mouza-details' || view === 'admin-data-entry')) {
      fetchMouzasData();
    }
  }, [selectedSiteId, view]);

  useEffect(() => {
    setSelectedOperatorIndex(0);
    setShowCompletionMessage(false);
  }, [adminDate, selectedSiteId, view]);

  useEffect(() => {
    if (view === 'admin-sites') {
      fetchSitesSummary();
    }
    if (view === 'admin-operators') {
      fetchOperatorsSummary();
    }
    if (view === 'operator-summary') {
      fetchAllOperators();
    }
  }, [view, selectedSiteId, operatorsMonth]);

  useEffect(() => {
    if (view === 'operator-summary' && selectedOperatorId) {
      fetchOperatorSummary();
    }
  }, [view, selectedOperatorId]);

  useEffect(() => {
    if (view === 'operator-summary' && selectedOperatorId && summaryMonth) {
      fetchOperatorDaily();
    }
  }, [view, selectedOperatorId, summaryMonth]);

  useEffect(() => {
    if (view === 'admin-sites' && editPastSiteId && editPastDate) {
      fetchSpecificDateEP(editPastSiteId, editPastDate);
    }
  }, [editPastSiteId, editPastDate, view]);

  useEffect(() => {
    if (view === 'admin-sites' && !editPastSiteId && sitesSummary.length > 0) {
      setEditPastSiteId(sitesSummary[0].id.toString());
    }
  }, [view, sitesSummary, editPastSiteId]);

  const fetchAllOperators = async () => {
    try {
      const res = await apiFetch('/api/all-operators');
      if (res.ok) {
        const data = await res.json();
        setAllOperators(data);

        // If user is linked to an operator, always select that one
        if (currentUser?.employee_id) {
          setSelectedOperatorId(currentUser.employee_id);
          return;
        }

        // Filter by selected site if admin
        const filtered = selectedSiteId && currentUser?.role === 'admin'
          ? data.filter((op: any) => String(op.site_id) === String(selectedSiteId))
          : data;
        if (filtered.length > 0) {
          setSelectedOperatorId(filtered[0].id);
        } else if (data.length > 0 && !selectedOperatorId) {
          setSelectedOperatorId(data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOperatorSummary = async () => {
    if (!selectedOperatorId) return;
    try {
      const res = await apiFetch(`/api/operator-summary/${selectedOperatorId}`);
      if (res.ok) {
        const data = await res.json();
        setOperatorSummary(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOperatorDaily = async () => {
    if (!selectedOperatorId || !summaryMonth) return;
    try {
      const res = await apiFetch(`/api/operator-daily/${selectedOperatorId}?month=${summaryMonth}`);
      if (res.ok) {
        const data = await res.json();
        setOperatorDaily(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateOperatorRate = async (id: string | number, rate: number) => {
    try {
      const res = await apiFetch(`/api/employees/${id}/rate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate })
      });
      if (res.ok) {
        setIsUpdatingRate(null);
        setNewRateValue('');
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateSiteRate = async (id: string | number, rate: number) => {
    try {
      const res = await apiFetch(`/api/sites/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate })
      });
      if (res.ok) {
        setIsUpdatingSiteRate(null);
        setNewSiteRateValue('');
        fetchSites();
        fetchSitesSummary();
        fetchStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateSiteUnit = async (id: string | number, unit: string) => {
    try {
      const res = await apiFetch(`/api/sites/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit })
      });
      if (res.ok) {
        setIsUpdatingSiteUnit(null);
        setNewSiteUnitValue('');
        fetchSites();
        fetchSitesSummary();
        fetchStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateSiteDefaultEP = async (id: string | number, defaultEP: number) => {
    try {
      const res = await apiFetch(`/api/sites/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_extra_pages: defaultEP })
      });
      if (res.ok) {
        setIsUpdatingSiteDefaultEP(null);
        setNewSiteDefaultEPValue('');
        fetchSites();
        fetchSitesSummary();
        fetchStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSpecificDateEP = async (siteId: string, date: string) => {
    if (!siteId || !date) return;
    setIsFetchingPastEP(true);
    try {
      const res = await apiFetch(`/api/sites/${siteId}/daily-extra-pages?date=${date}`);
      if (res.ok) {
        const data = await res.json();
        setEditPastEPValue((data.extra_pages || 0).toString());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingPastEP(false);
    }
  };

  const handleSavePastEP = async () => {
    if (!editPastSiteId || !editPastDate) return;
    setIsSavingPastEP(true);
    setPastEPMessage(null);
    try {
      const res = await apiFetch(`/api/sites/${editPastSiteId}/daily-extra-pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: editPastDate,
          extra_pages: parseInt(editPastEPValue) || 0
        })
      });
      if (res.ok) {
        fetchSitesSummary();
        fetchStats();
        setPastEPMessage({ type: 'success', text: `Successfully updated extra pages on ${editPastDate}` });
        setTimeout(() => setPastEPMessage(null), 4000);
      } else {
        setPastEPMessage({ type: 'error', text: 'Failed to update extra pages.' });
        setTimeout(() => setPastEPMessage(null), 4000);
      }
    } catch (err) {
      console.error(err);
      setPastEPMessage({ type: 'error', text: 'Connection error. Please try again.' });
      setTimeout(() => setPastEPMessage(null), 4000);
    } finally {
      setIsSavingPastEP(false);
    }
  };

  const handleCopy = (date: Date, files: number, pages: number) => {
    const dateStr = format(date, 'dd MMM yyyy');
    const unit = stats?.overall.unit || 'Files';
    const text = `${dateStr}\nTotal ${unit}: ${files}\nTotal Pages: ${pages}`;
    navigator.clipboard.writeText(text);
    setCopiedDate(format(date, 'yyyy-MM-dd'));
    setTimeout(() => setCopiedDate(null), 2000);
  };

  const fetchSitesSummary = async () => {
    try {
      const res = await apiFetch('/api/sites-summary');
      if (!res.ok) return;
      const data = await res.json();
      setSitesSummary(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOperatorsSummary = async () => {
    try {
      let url = selectedSiteId ? `/api/operators-summary?siteId=${selectedSiteId}` : '/api/operators-summary';
      if (operatorsMonth) {
        url += (url.includes('?') ? '&' : '?') + `month=${operatorsMonth}`;
      }
      const res = await apiFetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setOperatorsSummary(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSites = async () => {
    try {
      const res = await apiFetch('/api/sites');
      if (!res.ok) {
        if (res.status === 401) {
          console.log('[AUTH] fetchSites returned 401, resetting isAuthenticated');
          setIsAuthenticated(false);
        }
        return;
      }
      const data = await res.json();
      setSites(data);
      if (data.length > 0 && !selectedSiteId) {
        setSelectedSiteId(data[0].id);
      } else if (selectedSiteId && !data.find((s: any) => String(s.id) === String(selectedSiteId))) {
        setSelectedSiteId(data.length > 0 ? data[0].id : null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (mode: 'main' | 'personal' = 'main') => {
    if (!selectedSiteId) return;
    try {
      const res = await apiFetch(`/api/stats/${selectedSiteId}?mode=${mode}`);
      if (!res.ok) {
        if (res.status === 401) setIsAuthenticated(false);
        return;
      }
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMouzasData = async () => {
    if (!selectedSiteId) return;
    setMouzasLoading(true);
    setSelectedMouzaFilter('all');
    try {
      const res = await apiFetch(`/api/mouzas?siteId=${selectedSiteId}`);
      if (res.ok) {
        const data = await res.json();
        setMouzasData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMouzasLoading(false);
    }
  };

  const handleSetMouzaStatus = async (mouzaName: string, status: 'In Scanning' | 'Complete') => {
    if (!selectedSiteId) return;
    setUpdatingMouzaStatusName(mouzaName);
    try {
      const res = await apiFetch('/api/mouza-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: selectedSiteId,
          mouzaName,
          status
        })
      });
      if (res.ok) {
        await fetchMouzasData();
        await fetchStats(view === 'admin-data-entry' ? 'personal' : 'main');
      } else {
        alert("Failed to update Mouza status");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingMouzaStatusName(null);
    }
  };

  const fetchAdminData = async () => {
    if (!selectedSiteId) return;
    setAdminData([]);
    try {
      const res = await apiFetch(`/api/scanning-data?siteId=${selectedSiteId}&date=${adminDate}`);
      const data = await res.json();
      
      const processedData = (data.data || []).map((item: any) => {
        const mouzas = item.mouzas || [];
        const processedMouzas = mouzas.map((m: any) => {
          if (m.groupId) return m;
          const nameKey = (m.name || '').trim().toLowerCase() || 'unnamed';
          return {
            ...m,
            groupId: `g_fallback_${nameKey}`
          };
        });
        return {
          ...item,
          mouzas: processedMouzas
        };
      });

      setAdminData(processedData);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdminChange = (employeeId: string | number, field: 'files' | 'pages', value: string) => {
    const numValue = value === '' ? null : parseInt(value);
    setAdminData(prev => prev.map(item => 
      item.employee_id === employeeId ? { ...item, [field]: numValue } : item
    ));
  };

  const [isCopyingLastMouzas, setIsCopyingLastMouzas] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const handlePicLastMouzas = async () => {
    const operator = adminData[selectedOperatorIndex];
    if (!operator) return;
    setIsCopyingLastMouzas(true);
    setCopyFeedback(null);
    try {
      const res = await apiFetch(`/api/scanning-data/last-mouzas?employeeId=${operator.employee_id}&date=${adminDate}`);
      if (res.ok) {
        const result = await res.json();
        if (result.mouzas && result.mouzas.length > 0) {
          const nameToGroupIdMap = new Map<string, string>();
          const cleanedCopy = result.mouzas.map((m: any) => {
            const nameKey = (m.name || 'New Mouza').trim().toLowerCase();
            if (!nameToGroupIdMap.has(nameKey)) {
              nameToGroupIdMap.set(nameKey, `g_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
            }
            return {
              ...m,
              groupId: nameToGroupIdMap.get(nameKey)
            };
          });

          setAdminData(prev => prev.map((item, idx) => {
            if (idx === selectedOperatorIndex) {
              const sumOfQuantities = cleanedCopy.reduce((sum: number, curr: any) => sum + (parseInt(curr.quantity as any) || 0), 0);
              return {
                ...item,
                mouzas: cleanedCopy,
                files: sumOfQuantities
              };
            }
            return item;
          }));
          setCopyFeedback(`Successfully copied Mouzas from ${result.sourceDate}!`);
          setTimeout(() => setCopyFeedback(null), 4000);
        } else {
          setCopyFeedback("No previous Mouzas found for this operator.");
          setTimeout(() => setCopyFeedback(null), 4000);
        }
      } else {
        const errText = await res.text().catch(() => "");
        setCopyFeedback(`Failed to fetch last Mouzas: ${res.status} ${errText}`);
        setTimeout(() => setCopyFeedback(null), 6000);
      }
    } catch (err) {
      console.error("DEBUG last-mouzas err:", err);
      setCopyFeedback(`Error: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setCopyFeedback(null), 6000);
    } finally {
      setIsCopyingLastMouzas(false);
    }
  };

  const handleUpdateMouzaGroupStatus = (indices: number[], status: 'In Scanning' | 'Complete') => {
    setAdminData(prev => prev.map((item, idx) => {
      if (idx === selectedOperatorIndex) {
        const updated = (item.mouzas || []).map((m, mIdx) => {
          if (indices.includes(mIdx)) {
            return { ...m, status };
          }
          return m;
        });
        return { ...item, mouzas: updated };
      }
      return item;
    }));
  };

  const handleAddMouzaToCurrentOperator = () => {
    setAdminData(prev => prev.map((item, idx) => {
      if (idx === selectedOperatorIndex) {
        const existingMouzas = item.mouzas || [];
        const uniqueGroupId = `g_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newMouzas = [
          ...existingMouzas,
          {
            name: 'New Mouza',
            status: 'In Scanning' as const,
            years: '',
            type: 'RHZ' as const,
            quantity: 1,
            groupId: uniqueGroupId
          }
        ];
        const sumOfQuantities = newMouzas.reduce((sum, curr) => sum + (parseInt(curr.quantity as any) || 0), 0);
        return {
          ...item,
          mouzas: newMouzas,
          files: sumOfQuantities
        };
      }
      return item;
    }));
  };

  const handleAddRowToMouzaGroup = (mouzaGroupId: string, mouzaName: string) => {
    setAdminData(prev => prev.map((item, idx) => {
      if (idx === selectedOperatorIndex) {
        const existingMouzas = item.mouzas || [];
        const newMouzas = [
          ...existingMouzas,
          {
            name: mouzaName,
            status: 'In Scanning' as const,
            years: '',
            type: 'RHZ' as const,
            quantity: 1,
            groupId: mouzaGroupId
          }
        ];
        const sumOfQuantities = newMouzas.reduce((sum, curr) => sum + (parseInt(curr.quantity as any) || 0), 0);
        return {
          ...item,
          mouzas: newMouzas,
          files: sumOfQuantities
        };
      }
      return item;
    }));
  };

  const handleRenameMouzaGroup = (indices: number[], newName: string) => {
    setAdminData(prev => prev.map((item, idx) => {
      if (idx === selectedOperatorIndex) {
        const updated = (item.mouzas || []).map((m, mIdx) => {
          if (indices.includes(mIdx)) {
            return { ...m, name: newName };
          }
          return m;
        });
        return { ...item, mouzas: updated };
      }
      return item;
    }));
  };

  const handleUpdateMouzaField = (mouzaIdx: number, field: keyof MouzaEntry, value: any) => {
    setAdminData(prev => prev.map((item, idx) => {
      if (idx === selectedOperatorIndex) {
        const updatedMouzas = (item.mouzas || []).map((m, mIdx) => {
          if (mIdx === mouzaIdx) {
            return { ...m, [field]: value };
          }
          return m;
        });
        
        // Auto-sum whenever quantity is updated/modified
        let updatedFiles = item.files;
        if (field === 'quantity') {
          const sumOfQuantities = updatedMouzas.reduce((sum, curr) => sum + (parseInt(curr.quantity as any) || 0), 0);
          updatedFiles = sumOfQuantities;
        }

        return { ...item, mouzas: updatedMouzas, files: updatedFiles };
      }
      return item;
    }));
  };

  const handleRemoveMouza = (mouzaIdx: number) => {
    setAdminData(prev => prev.map((item, idx) => {
      if (idx === selectedOperatorIndex) {
        const updatedMouzas = (item.mouzas || []).filter((_, mIdx) => mIdx !== mouzaIdx);
        // Auto-sum after removal
        const sumOfQuantities = updatedMouzas.reduce((sum, curr) => sum + (parseInt(curr.quantity as any) || 0), 0);
        return { ...item, mouzas: updatedMouzas, files: sumOfQuantities };
      }
      return item;
    }));
  };

  const handleRemoveMouzaGroup = (indices: number[]) => {
    setAdminData(prev => prev.map((item, idx) => {
      if (idx === selectedOperatorIndex) {
        const updatedMouzas = (item.mouzas || []).filter((_, mIdx) => !indices.includes(mIdx));
        // Auto-sum after removal
        const sumOfQuantities = updatedMouzas.reduce((sum, curr) => sum + (parseInt(curr.quantity as any) || 0), 0);
        return { ...item, mouzas: updatedMouzas, files: sumOfQuantities };
      }
      return item;
    }));
  };

  const saveAdminData = async (): Promise<boolean> => {
    if (!selectedSiteId) return false;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const res = await apiFetch('/api/scanning-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: selectedSiteId,
          date: adminDate,
          entries: adminData.map(item => ({
            employee_id: item.employee_id,
            files: item.files || 0,
            pages: item.pages || 0,
            mouzas: item.mouzas || []
          }))
        })
      });
      
      if (res.ok) {
        setSaveMessage({ type: 'success', text: 'Data saved successfully!' });
        fetchStats(view === 'admin-data-entry' ? 'personal' : 'main');
        setTimeout(() => setSaveMessage(null), 3000);
        return true;
      } else {
        setSaveMessage({ type: 'error', text: 'Failed to save data. Please try again.' });
        return false;
      }
    } catch (err) {
      console.error(err);
      setSaveMessage({ type: 'error', text: 'Network error. Please try again.' });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndNextOperator = async () => {
    const success = await saveAdminData();
    if (success) {
      if (selectedOperatorIndex === adminData.length - 1) {
        setShowCompletionMessage(true);
      } else {
        setSelectedOperatorIndex(prev => prev + 1);
        setShowCompletionMessage(false);
      }
    }
  };

  const downloadReport = async (mode: 'personal' | 'main' = 'personal') => {
    if (!selectedSiteId) return;
    setIsDownloading(mode);
    const token = localStorage.getItem('authToken');
    
    let url = `/api/export/${selectedSiteId}?mode=${mode}&token=${token || ''}`;
    let filename = `${mode}-report.xlsx`;
    if (exportType === 'month') {
      url += `&month=${exportMonth}`;
      filename = `${exportMonth}-${mode}.xlsx`;
    } else {
      url += `&startDate=${exportStartDate}&endDate=${exportEndDate}`;
      filename = `report-${exportStartDate}-to-${exportEndDate}-${mode}.xlsx`;
    }

    try {
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDownloading(null);
    }
  };

  const downloadPDFReport = async () => {
    // Pages, registers/files, and mouzas count taken directly from stats overall (which corresponds to dashboard)
    let finalPages = stats?.overall?.total_pages || 0;
    let finalFiles = stats?.overall?.total_files || 0;
    let finalMouzas = stats?.overall?.total_mouza_scanned || 0;
    let siteName = "MULTAN";

    const selectedSite = sitesSummary.find(s => String(s.id) === String(selectedSiteId));
    if (selectedSite) {
      siteName = selectedSite.name.toUpperCase();
    }

    try {
      // Fetch latest overall main statistics to match the Dashboard page "Scanned Pages" precisely
      const res = await apiFetch(`/api/stats/${selectedSiteId}?mode=main`);
      if (res.ok) {
        const mainStats = await res.json();
        if (mainStats && mainStats.overall) {
          finalPages = mainStats.overall.total_pages || 0;
          finalFiles = mainStats.overall.total_files || 0;
          finalMouzas = mainStats.overall.total_mouza_scanned || 0;
        }
      }
    } catch (e) {
      console.error("Error fetching main stats for PDF:", e);
    }

    // Resolve jsPDF constructor safely to bypass Vite bundle compatibility issues
    let ResolvedConstructor = jsPDF as any;
    if (typeof ResolvedConstructor !== 'function') {
      if (ResolvedConstructor && ResolvedConstructor.jsPDF) {
        ResolvedConstructor = ResolvedConstructor.jsPDF;
      } else if (ResolvedConstructor && ResolvedConstructor.default) {
        ResolvedConstructor = ResolvedConstructor.default;
      }
    }

    const doc = new ResolvedConstructor({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Color theme
    const primaryIndigo = [79, 70, 229];
    const borderSlate = [226, 232, 240];

    // Background Top Header Band
    doc.setFillColor(primaryIndigo[0], primaryIndigo[1], primaryIndigo[2]);
    doc.rect(0, 0, 210, 48, 'F');

    // Title Block Text with spacing
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(26);
    doc.text(`${siteName} SCANNING STATUS SUMMARY`, 20, 28);

    // Dynamic Date Generation line banner
    doc.setFillColor(30, 41, 59); // Slate 800 sub-band
    doc.rect(0, 48, 210, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("Helvetica", "bold");
    doc.text(`REPORT EXPORT DATE: ${new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 20, 54);

    // Metrics container box
    doc.setFillColor(248, 250, 252); // Slate 50 background for card metrics
    doc.roundedRect(15, 75, 180, 85, 4, 4, 'F');
    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]); // Slate 200 border
    doc.setLineWidth(0.6);
    doc.roundedRect(15, 75, 180, 85, 4, 4, 'D');

    // Box Header Label
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.text("CORE METRIC MEASUREMENTS", 25, 88);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(25, 93, 185, 93);

    // Row 1: TOTAL PAGES SCANNED (Sum calculated appropriately)
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.text("TOTAL PAGES SCANNED :", 25, 110);

    doc.setTextColor(79, 70, 229); // Indigo/Purple
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.text(finalPages.toLocaleString(), 145, 110);

    // Row 2: TOTAL REGISTERS SCANNED
    doc.setTextColor(30, 41, 59); 
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.text("TOTAL REGISTERS SCANNED :", 25, 128);

    doc.setTextColor(30, 41, 59); // Slate 800
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.text(finalFiles.toLocaleString(), 145, 128);

    // Row 3: TOTAL MOUZAS SCANNED
    doc.setTextColor(30, 41, 59); 
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.text("TOTAL MOUZAS SCANNED :", 25, 146);

    doc.setTextColor(5, 150, 105); // Emerald green
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.text(finalMouzas.toLocaleString(), 145, 146);

    doc.save(`${siteName}_SCANNING_SUMMARY.pdf`);
  };

  const downloadSkippedYearsCSV = () => {
    if (!mouzasData || mouzasData.length === 0) {
      alert("No Mouza data available to export. Please ensure registers have been added.");
      return;
    }

    const endYearValue = 2007;

    // Build CSV with BOM for proper Excel UTF-8 support (important for custom Urdu names, etc.)
    let csvContent = "\uFEFF";
    csvContent += "Sr. No.,Mouza Name,Minimum Scanned Year,Scanned Years Count,Existing Scanned Years,Skipped Years (up to 2007)\n";

    mouzasData.forEach((m, idx) => {
      const RHZList = m.RHZ || [];
      const MutationList = m.Mutation || [];
      const ShajraList = m.Shajra || [];
      const allRegs = [...RHZList, ...MutationList, ...ShajraList];

      // Read unique raw scanned years entered (e.g. "1885-1886")
      const scannedRawYears = Array.from(new Set(allRegs.map((r: any) => r.years?.trim()).filter(Boolean)));
      
      const parseStartYear = (s: string): number | null => {
        if (!s) return null;
        const match = s.match(/(\d{4})/);
        if (match) {
          const y = parseInt(match[1], 10);
          if (y >= 1000 && y <= 9999) return y;
        }
        return null;
      };

      // Sort raw year-ranges chronologically
      scannedRawYears.sort((a, b) => {
        const ya = parseStartYear(a) || 0;
        const yb = parseStartYear(b) || 0;
        return ya - yb;
      });

      const scannedStartYearsSet = new Set(
        allRegs
          .map((r: any) => parseStartYear(r.years))
          .filter((y): y is number => y !== null)
      );

      let skippedYearsList: string[] = [];
      let minYear = 0;

      if (scannedStartYearsSet.size > 0) {
        minYear = Math.min(...scannedStartYearsSet);
        const maxStartYear = endYearValue - 1; // 2006 (corresponds to 2006 to 2007)

        for (let yr = minYear; yr <= maxStartYear; yr++) {
          if (!scannedStartYearsSet.has(yr)) {
            skippedYearsList.push(`${yr} to ${yr + 1}`);
          }
        }
      }

      const mouzaNameEscaped = `"${m.name.replace(/"/g, '""')}"`;
      const startYearStr = minYear ? minYear.toString() : "-";
      const scannedStr = `"${scannedRawYears.join(", ").replace(/"/g, '""')}"`;
      const skippedStr = `"${skippedYearsList.join(", ").replace(/"/g, '""')}"`;

      csvContent += `${idx + 1},${mouzaNameEscaped},${startYearStr},${scannedRawYears.length},${scannedStr},${skippedStr}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    const site = sitesSummary.find(s => String(s.id) === String(selectedSiteId));
    const sitePrefix = site ? site.name.replace(/\s+/g, '_').toUpperCase() : "MOUZA";
    
    link.download = `${sitePrefix}_MOUZAS_SKIPPED_YEARS_2007.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadSkippedYearsPDF = () => {
    if (!mouzasData || mouzasData.length === 0) {
      alert("No Mouza data available to export.");
      return;
    }

    let ResolvedConstructor = jsPDF as any;
    if (typeof ResolvedConstructor !== 'function') {
      if (ResolvedConstructor && ResolvedConstructor.jsPDF) {
        ResolvedConstructor = ResolvedConstructor.jsPDF;
      } else if (ResolvedConstructor && ResolvedConstructor.default) {
        ResolvedConstructor = ResolvedConstructor.default;
      }
    }

    const doc = new ResolvedConstructor({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryIndigo = [79, 70, 229];
    const textDark = [30, 41, 59];
    const borderSlate = [226, 232, 240];

    const site = sitesSummary.find(s => String(s.id) === String(selectedSiteId));
    const siteName = site ? site.name.toUpperCase() : "SITE";

    let pageNum = 1;

    const drawHeader = () => {
      doc.setFillColor(primaryIndigo[0], primaryIndigo[1], primaryIndigo[2]);
      doc.rect(0, 0, 210, 26, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.text(`${siteName} - MOUZAS GAP ANALYSIS REPORT`, 15, 11);

      doc.setFontSize(8);
      doc.setFont("Helvetica", "normal");
      doc.text(`Generated: ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} | Target End Year: 2007`, 15, 17);

      doc.text(`Page ${pageNum}`, 185, 11);

      // Header row background
      doc.setFillColor(241, 245, 249);
      doc.rect(15, 26, 180, 8, 'F');
      doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
      doc.line(15, 26, 195, 26);
      doc.line(15, 34, 195, 34);

      doc.setTextColor(71, 85, 105);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.text("Sr.", 17, 31);
      doc.text("Mouza Name", 26, 31);
      doc.text("Scanned Volumes / Years", 70, 31);
      doc.text("Skipped Years (up to 2007)", 125, 31);
    };

    drawHeader();

    let y = 39;

    mouzasData.forEach((m, idx) => {
      const RHZList = m.RHZ || [];
      const MutationList = m.Mutation || [];
      const ShajraList = m.Shajra || [];
      const allRegs = [...RHZList, ...MutationList, ...ShajraList];

      const scannedRawYears = Array.from(new Set(allRegs.map((r: any) => r.years?.trim()).filter(Boolean)));
      
      const parseStartYear = (s: string): number | null => {
        if (!s) return null;
        const match = s.match(/(\d{4})/);
        if (match) {
          const y = parseInt(match[1], 10);
          if (y >= 1000 && y <= 9999) return y;
        }
        return null;
      };

      scannedRawYears.sort((a, b) => {
        const ya = parseStartYear(a) || 0;
        const yb = parseStartYear(b) || 0;
        return ya - yb;
      });

      const scannedStartYearsSet = new Set(
        allRegs
          .map((r: any) => parseStartYear(r.years))
          .filter((y): y is number => y !== null)
      );

      let skippedYearsList: string[] = [];
      let minYear = 0;

      if (scannedStartYearsSet.size > 0) {
        minYear = Math.min(...scannedStartYearsSet);
        const maxStartYear = 2006;

        for (let yr = minYear; yr <= maxStartYear; yr++) {
          if (!scannedStartYearsSet.has(yr)) {
            skippedYearsList.push(`${yr}-${yr + 1}`);
          }
        }
      }

      const scannedTextRaw = scannedRawYears.length > 0 ? scannedRawYears.join(", ") : "-";
      const skippedTextRaw = skippedYearsList.length > 0 ? skippedYearsList.join(", ") : "-";

      const scannedLines = doc.splitTextToSize(scannedTextRaw, 50);
      const skippedLines = doc.splitTextToSize(skippedTextRaw, 65);

      const rowHeight = Math.max(scannedLines.length, skippedLines.length) * 4.5 + 4;

      if (y + rowHeight > 280) {
        doc.addPage();
        pageNum++;
        drawHeader();
        y = 39;
      }

      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(15, y - 3, 180, rowHeight, 'F');
      }

      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`${idx + 1}`, 17, y);
      
      doc.setFont("Helvetica", "bold");
      doc.text(m.name || '', 26, y);

      doc.setFont("Helvetica", "normal");
      scannedLines.forEach((line: string, i: number) => {
        doc.text(line, 70, y + i * 4.5);
      });

      if (skippedYearsList.length > 0) {
        doc.setTextColor(180, 83, 9); // amber 700
      } else {
        doc.setTextColor(100, 116, 139); // slate 500
      }
      
      skippedLines.forEach((line: string, i: number) => {
        doc.text(line, 125, y + i * 4.5);
      });

      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.3);
      doc.line(15, y + rowHeight - 3, 195, y + rowHeight - 3);

      y += rowHeight;
    });

    const sitePrefix = site ? site.name.replace(/\s+/g, '_').toUpperCase() : "MOUZA";
    doc.save(`${sitePrefix}_MOUZAS_SKIPPED_YEARS_2007.pdf`);
  };

  const handleAddSite = async () => {
    if (!newSiteName) return;
    try {
      const res = await apiFetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newSiteName, 
          target_files: parseInt(newSiteTarget) || 0,
          rate: parseFloat(newSiteRate) || 0.3,
          unit: newSiteUnit || 'Files',
          default_extra_pages: parseInt(newSiteDefaultExtraPages) || 0
        })
      });
      if (res.ok) {
        setNewSiteName('');
        setNewSiteTarget('');
        setNewSiteRate('0.3');
        setNewSiteUnit('Files');
        setNewSiteDefaultExtraPages('0');
        fetchSites();
        fetchSitesSummary();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddEmployee = async () => {
    if (!newEmployeeName || !selectedSiteId) return;
    setAddEmployeeMessage(null);
    try {
      const res = await apiFetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newEmployeeName, site_id: selectedSiteId })
      });
      if (res.ok) {
        setAddEmployeeMessage({ type: 'success', text: `"${newEmployeeName}" added successfully!` });
        setNewEmployeeName('');
        await fetchAdminData();
        await fetchStats();
        setTimeout(() => setAddEmployeeMessage(null), 3000);
      } else {
        const data = await res.json();
        setAddEmployeeMessage({ type: 'error', text: data.error || 'Failed to add operator.' });
      }
    } catch (err) {
      console.error(err);
      setAddEmployeeMessage({ type: 'error', text: 'Network error. Please try again.' });
    }
  };

  const handleUpdateTarget = async () => {
    if (!selectedSiteId || !updateTargetValue) return;
    try {
      await apiFetch(`/api/sites/${selectedSiteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_files: parseInt(updateTargetValue) })
      });
      setUpdateTargetValue('');
      fetchStats();
      fetchSites();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateMouza = async () => {
    if (!selectedSiteId || !updateMouzaValue) return;
    try {
      await apiFetch(`/api/sites/${selectedSiteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total_mouza_scanned: parseInt(updateMouzaValue) || 0 })
      });
      setUpdateMouzaValue('');
      fetchStats();
      fetchSites();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteEmployee = async (id: string | number) => {
    if (id === undefined || id === null) {
      console.error('Invalid ID provided for deletion');
      return;
    }
    
    try {
      const res = await apiFetch(`/api/employees/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to deactivate operator');
      }
      
      await fetchAdminData();
      await fetchStats();
      setConfirmDeleteEmployeeId(null);
    } catch (err) {
      console.error('Deactivation error:', err);
      alert(err instanceof Error ? err.message : 'Error deactivating operator. Please try again.');
    }
  };

  const handleDeleteSite = async (id: string | number) => {
    try {
      const res = await apiFetch(`/api/sites/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete site');
      }

      setConfirmDeleteSite(null);
      // If deleted site was selected, clear it
      if (String(selectedSiteId) === String(id)) {
        setSelectedSiteId(null);
        setStats(null);
      }
      await fetchSites();
      await fetchSitesSummary();
    } catch (err) {
      console.error('Site delete error:', err);
      alert(err instanceof Error ? err.message : 'Error deleting site. Please try again.');
    }
  };

  const getCompletionForecast = () => {
    if (!stats || !stats.overall.target_files || !stats.overall.total_files) return null;
    
    const remaining = Math.max(0, stats.overall.target_files - stats.overall.total_files);
    if (remaining === 0) return "Completed!";

    // Use last 7 days average if possible, otherwise overall average
    const recentDays = stats.weekly.filter(w => w.files > 0).slice(0, 7);
    const avgRate = recentDays.length > 0 
      ? recentDays.reduce((sum, d) => sum + d.files, 0) / recentDays.length
      : (stats.overall.total_files / Math.max(1, stats.weekly.length));

    if (avgRate <= 0) return "No data to forecast";

    const daysRemaining = Math.ceil(remaining / avgRate);
    const completionDate = addDays(new Date(), daysRemaining);

    return {
      days: daysRemaining,
      date: format(completionDate, 'MMMM d, yyyy'),
      rate: Math.round(avgRate)
    };
  };

  const forecast = getCompletionForecast();

  // Ordered views for swipe navigation based on user permissions
  const getSwipeViews = () => {
    if (currentUser?.role === 'admin') {
      return ['main-view', 'personal-records', 'mouza-details', 'admin-data-entry', 'admin-reports', 'admin-sites', 'admin-operators', 'admin-management', 'operator-summary', 'user-controls', 'apps'];
    }
    const permOrder = ['main-view', 'personal-records', 'mouza-details', 'admin-data-entry', 'admin-reports', 'admin-sites', 'admin-operators', 'admin-management', 'operator-summary', 'apps'];
    return permOrder.filter(p => hasPermission(p) || p === 'apps');
  };

  const handleSwipe = (direction: 'left' | 'right') => {
    const views = getSwipeViews();
    const currentIndex = views.indexOf(view);
    if (currentIndex === -1) return;
    if (direction === 'left' && currentIndex < views.length - 1) {
      setView(views[currentIndex + 1] as any);
    } else if (direction === 'right' && currentIndex > 0) {
      setView(views[currentIndex - 1] as any);
    }
  };

  // Touch swipe state
  const touchStartX = React.useRef<number>(0);
  const touchStartY = React.useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (view === 'admin-data-entry') return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (view === 'admin-data-entry') return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    // Only swipe if horizontal movement > 80px and more horizontal than vertical
    if (Math.abs(deltaX) > 80 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0) handleSwipe('left');   // swipe left = next page
      else handleSwipe('right');              // swipe right = prev page
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-full"></div>
          <p className="text-slate-500 font-medium">Verifying Session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={checkAuth} />;
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-6">
        <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-900/20">
          <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-white" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h10" />
            <path d="M18 15l3 3-3 3" opacity={0.5} />
          </svg>
        </div>
        <p className="text-slate-400 font-bold tracking-widest uppercase text-xs">Loading ScanTrack Pro</p>
      </div>
    </div>
  );

  return (
    <div 
      className="min-h-screen bg-slate-50 text-slate-900 font-sans"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Sidebar / Nav */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-black/5 z-50 px-4 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/10">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h10" />
              <path d="M18 15l3 3-3 3" opacity={0.5} />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight hidden lg:block">ScanTrack Pro</h1>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center gap-1 ml-6 border-l border-slate-100 pl-6">
            {hasPermission('main-view') && (
              <button 
                onClick={() => setView('main-view')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                  view === 'main-view' ? "bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100/50" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                Dashboard
              </button>
            )}
            {hasPermission('personal-records') && (
              <button 
                onClick={() => setView('personal-records')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                  view === 'personal-records' ? "bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100/50" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Records
              </button>
            )}
            {hasPermission('admin-data-entry') && (
              <button 
                onClick={() => setView('admin-data-entry')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                  view === 'admin-data-entry' ? "bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100/50" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Plus className="w-3.5 h-3.5" />
                Entry
              </button>
            )}
            {hasPermission('admin-reports') && (
              <button 
                onClick={() => setView('admin-reports')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                  view === 'admin-reports' ? "bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100/50" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Download className="w-3.5 h-3.5" />
                Downloads
              </button>
            )}
            {hasPermission('admin-sites') && (
              <button 
                onClick={() => setView('admin-sites')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                  view === 'admin-sites' ? "bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100/50" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                Sites
              </button>
            )}
            {hasPermission('admin-operators') && (
              <button 
                onClick={() => setView('admin-operators')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                  view === 'admin-operators' ? "bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100/50" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Users className="w-3.5 h-3.5" />
                Operators
              </button>
            )}
            {hasPermission('operator-summary') && (
              <button 
                onClick={() => setView('operator-summary')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                  view === 'operator-summary' ? "bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100/50" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <FileText className="w-3.5 h-3.5" />
                Summary
              </button>
            )}
             {hasPermission('mouza-details') && (
              <button 
                onClick={() => setView('mouza-details')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                  view === 'mouza-details' ? "bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100/50" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Map className="w-3.5 h-3.5" />
                Mouza Details
              </button>
            )}
            {currentUser?.role === 'admin' && (
              <button 
                onClick={() => setView('user-controls')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                  view === 'user-controls' ? "bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100/50" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <UserCog className="w-3.5 h-3.5" />
                Users
              </button>
            )}
            {hasPermission('admin-management') && (
              <button 
                onClick={() => setView('admin-management')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                  view === 'admin-management' ? "bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100/50" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Settings className="w-3.5 h-3.5" />
                Settings
              </button>
            )}
            <button 
              onClick={() => setView('apps')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                view === 'apps' ? "bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100/50" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Globe className="w-3.5 h-3.5" />
              Apps
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {currentUser?.role === 'admin' ? (
            <div className="relative lg:hidden">
              <button 
                onClick={() => { setIsMenuOpen(!isMenuOpen); setIsSiteOpen(false); }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border shadow-sm",
                  isMenuOpen 
                    ? "bg-indigo-600 text-white border-indigo-600" 
                    : "bg-white text-slate-700 border-slate-200 hover:border-indigo-200 hover:bg-slate-50"
                )}
              >
                {isMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                <span>Menu</span>
                <ChevronDown className={cn("w-3 h-3 transition-transform", isMenuOpen && "rotate-180")} />
              </button>

              <AnimatePresence>
                {isMenuOpen && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsMenuOpen(false)}
                      className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
                    />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden"
                    >
                      <div className="p-2 space-y-1">
                        { (hasPermission('main-view') || hasPermission('personal-records')) && (
                          <>
                            <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">General</div>
                            {hasPermission('main-view') && (
                              <button 
                                onClick={() => { setView('main-view'); setIsMenuOpen(false); }}
                                className={cn(
                                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all",
                                  view === 'main-view' ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50"
                                )}
                              >
                                <LayoutDashboard className="w-4 h-4" />
                                Dashboard
                              </button>
                            )}
                            {hasPermission('personal-records') && (
                              <button 
                                onClick={() => { setView('personal-records'); setIsMenuOpen(false); }}
                                className={cn(
                                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all",
                                  view === 'personal-records' ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50"
                                )}
                              >
                                <TrendingUp className="w-4 h-4" />
                                Personal Records
                              </button>
                            )}
                          </>
                        )}

                        { (hasPermission('admin-data-entry') || hasPermission('admin-reports') || hasPermission('admin-sites') || hasPermission('admin-operators') || hasPermission('admin-management')) && (
                          <>
                            <div className="h-px bg-slate-100 my-2 mx-2" />
                            <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Admin Tools</div>
                            
                            {hasPermission('admin-data-entry') && (
                              <button 
                                onClick={() => { setView('admin-data-entry'); setIsMenuOpen(false); }}
                                className={cn(
                                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all",
                                  view === 'admin-data-entry' ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50"
                                )}
                              >
                                <Plus className="w-4 h-4" />
                                Data Entry
                              </button>
                            )}
                            {hasPermission('admin-reports') && (
                              <button 
                                onClick={() => { setView('admin-reports'); setIsMenuOpen(false); }}
                                className={cn(
                                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all",
                                  view === 'admin-reports' ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50"
                                )}
                              >
                                <Download className="w-4 h-4" />
                                Downloads
                              </button>
                            )}
                            {hasPermission('admin-sites') && (
                              <button 
                                onClick={() => { setView('admin-sites'); setIsMenuOpen(false); }}
                                className={cn(
                                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all",
                                  view === 'admin-sites' ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50"
                                )}
                              >
                                <Layers className="w-4 h-4" />
                                Manage Sites
                              </button>
                            )}
                            {hasPermission('admin-operators') && (
                              <button 
                                onClick={() => { setView('admin-operators'); setIsMenuOpen(false); }}
                                className={cn(
                                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all",
                                  view === 'admin-operators' ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50"
                                )}
                              >
                                <Users className="w-4 h-4" />
                                Operators
                              </button>
                            )}
                            {hasPermission('admin-management') && (
                              <button 
                                onClick={() => { setView('admin-management'); setIsMenuOpen(false); }}
                                className={cn(
                                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all",
                                  view === 'admin-management' ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50"
                                )}
                              >
                                <Settings className="w-4 h-4" />
                                Settings
                              </button>
                            )}
                            <button 
                              onClick={() => { setView('apps'); setIsMenuOpen(false); }}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all",
                                view === 'apps' ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50"
                              )}
                            >
                              <Globe className="w-4 h-4" />
                              Apps Center
                            </button>
                          </>
                        )}

                        {currentUser?.role === 'admin' && (
                          <>
                            <div className="h-px bg-slate-100 my-2 mx-2" />
                            <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account</div>

                            <button 
                              onClick={() => { setView('user-controls'); setIsMenuOpen(false); }}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all",
                                view === 'user-controls' ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50"
                              )}
                            >
                              <UserCog className="w-4 h-4" />
                              User Controls
                            </button>
                          </>
                        )}

                        {hasPermission('operator-summary') && (
                          <button 
                            onClick={() => { setView('operator-summary'); setIsMenuOpen(false); }}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all",
                              view === 'operator-summary' ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            <FileText className="w-4 h-4" />
                            Operator Summary
                          </button>
                        )}
                        {hasPermission('mouza-details') && (
                          <button 
                            onClick={() => { setView('mouza-details'); setIsMenuOpen(false); }}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all",
                              view === 'mouza-details' ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            <Map className="w-4 h-4" />
                            Mouza Details
                          </button>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="relative lg:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border shadow-sm",
                  isMenuOpen
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-700 border-slate-200 hover:border-indigo-200 hover:bg-slate-50"
                )}
              >
                <User className="w-4 h-4" />
                <span>{currentUser?.username}</span>
                <ChevronDown className={cn("w-3 h-3 transition-transform", isMenuOpen && "rotate-180")} />
              </button>
              <AnimatePresence>
                {isMenuOpen && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsMenuOpen(false)}
                      className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden"
                    >
                      <div className="p-2 space-y-1">
                        {hasPermission('main-view') && (
                          <button onClick={() => { setView('main-view'); setIsMenuOpen(false); }} className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all", view === 'main-view' ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50")}>
                            <LayoutDashboard className="w-4 h-4" /> Dashboard
                          </button>
                        )}
                        {hasPermission('personal-records') && (
                          <button onClick={() => { setView('personal-records'); setIsMenuOpen(false); }} className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all", view === 'personal-records' ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50")}>
                            <TrendingUp className="w-4 h-4" /> Personal Records
                          </button>
                        )}
                        {hasPermission('operator-summary') && (
                          <button onClick={() => { setView('operator-summary'); setIsMenuOpen(false); }} className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all", view === 'operator-summary' ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50")}>
                            <FileText className="w-4 h-4" /> Operator Summary
                          </button>
                        )}
                        {hasPermission('mouza-details') && (
                          <button onClick={() => { setView('mouza-details'); setIsMenuOpen(false); }} className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all", view === 'mouza-details' ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50")}>
                            <Map className="w-4 h-4" /> Mouza Details
                          </button>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="flex items-center gap-2 sm:gap-4 ml-auto sm:ml-4 sm:pl-4 sm:border-l border-slate-200">
            {/* Site selector — admin always, non-admin only if 2+ sites */}
            {(currentUser?.role === 'admin' || (currentUser?.role !== 'admin' && sites.length > 1)) && (
              <div className="relative">
                <button
                  onClick={() => { setIsSiteOpen(!isSiteOpen); setIsMenuOpen(false); }}
                  className="flex items-center gap-2 bg-slate-50 border border-black/5 rounded-xl px-2 py-1.5 sm:px-3 hover:bg-slate-100 transition-all"
                >
                  <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shadow-sm shadow-indigo-100 shrink-0">
                    {sites.find(s => s.id === selectedSiteId)?.name.substring(0, 2).toUpperCase() || 'ST'}
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-0.5">Active Site</span>
                    <span className="text-[11px] sm:text-xs font-bold text-slate-700">
                      {sites.find(s => s.id === selectedSiteId)?.name || 'Select'}
                    </span>
                  </div>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                <AnimatePresence>
                  {isSiteOpen && (
                    <>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsSiteOpen(false)}
                        className="fixed inset-0 z-40"
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        className="absolute top-full right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden"
                      >
                        <div className="p-1.5">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2">Select Site</p>
                          {sites.map(site => (
                            <button
                              key={site.id}
                              onClick={() => { setSelectedSiteId(site.id); setIsSiteOpen(false); }}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all",
                                String(site.id) === String(selectedSiteId)
                                  ? "bg-indigo-50 text-indigo-600"
                                  : "text-slate-600 hover:bg-slate-50"
                              )}
                            >
                              <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                {site.name.substring(0, 2).toUpperCase()}
                              </div>
                              {site.name}
                              {String(site.id) === String(selectedSiteId) && (
                                <Check className="w-3.5 h-3.5 ml-auto text-indigo-600" />
                              )}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
            
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-xl transition-all shadow-lg shadow-rose-100"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="pb-20 px-3 md:px-8 max-w-7xl mx-auto pt-20">
        <AnimatePresence mode="wait">
          {view === 'main-view' && hasPermission('main-view') ? (
            <motion.div 
              key="main-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h2>
                  <p className="text-slate-500 font-medium">Welcome back, {currentUser?.username || 'Admin'}</p>
                </div>
              </div>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-6">
                <StatCard 
                  title={`Scanned ${stats?.overall.unit || 'Files'}`} 
                  value={stats?.overall.total_files?.toLocaleString() || '0'} 
                  icon={FileText} 
                  colorClass="bg-blue-500"
                  loading={!stats || stats.mode !== 'main'}
                />
                <StatCard 
                  title="Scanned Pages" 
                  value={stats?.overall.total_pages?.toLocaleString() || '0'} 
                  icon={Layers} 
                  colorClass="bg-indigo-500"
                  loading={!stats || stats.mode !== 'main'}
                />
                <StatCard 
                  title="Total Mouza Scanned" 
                  value={stats?.overall.total_mouza_scanned?.toLocaleString() || '0'} 
                  icon={Map} 
                  colorClass="bg-emerald-500"
                  loading={!stats || stats.mode !== 'main'}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Month Wise Table */}
                <Card className="lg:col-span-1">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-indigo-600" />
                    Month Wise Progress
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-400 font-medium border-b border-black/5">
                          <th className="text-left pb-3">Month</th>
                          <th className="text-right pb-3">{stats?.overall.unit || 'Files'}</th>
                          <th className="text-right pb-3">Pages</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5">
                        {stats?.monthly.map((m, i) => (
                          <tr key={i} className="group hover:bg-slate-50 transition-colors">
                            <td className="py-4 font-medium text-slate-700">{format(parseISO(m.month + '-01'), 'MMMM yyyy')}</td>
                            <td className="py-4 text-right font-mono text-slate-600">{m.files?.toLocaleString() || '0'}</td>
                            <td className="py-4 text-right font-mono text-slate-600">{m.pages?.toLocaleString() || '0'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Week Table */}
                <Card className="lg:col-span-2">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-indigo-600" />
                      Weekly Activity
                    </h3>
                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                      <button 
                        onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
                        className="p-1.5 hover:bg-white rounded-lg transition-all"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-bold px-2 uppercase tracking-tighter">
                        {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d')}
                      </span>
                      <button 
                        onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
                        className="p-1.5 hover:bg-white rounded-lg transition-all"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-400 font-medium border-b border-black/5">
                          <th className="text-left pb-3">Date</th>
                          <th className="text-right pb-3">{stats?.overall.unit || 'Files'}</th>
                          <th className="text-right pb-3">Pages</th>
                          <th className="w-10 pb-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5">
                        {eachDayOfInterval({
                          start: currentWeekStart,
                          end: addDays(currentWeekStart, 6)
                        }).map((day, i) => {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          const dayData = stats?.weekly.find(w => w.date === dateStr);
                          const isSunday = day.getDay() === 0;

                          return (
                            <tr key={i} className="group hover:bg-slate-50 transition-colors">
                              <td className="py-4 font-medium text-slate-700">
                                {format(day, 'EEE, MMM d')}
                              </td>
                              <td className="py-4 text-right font-mono text-slate-600">{dayData?.files?.toLocaleString() || '-'}</td>
                              <td className="py-4 text-right font-mono text-slate-600">{dayData?.pages?.toLocaleString() || '-'}</td>
                              <td className="py-4 text-right">
                                <button 
                                  onClick={() => handleCopy(day, dayData?.files || 0, dayData?.pages || 0)}
                                  className={cn(
                                    "p-1.5 rounded-lg transition-all",
                                    copiedDate === dateStr 
                                      ? "bg-emerald-100 text-emerald-600" 
                                      : "text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                                  )}
                                  title="Copy to clipboard"
                                >
                                  {copiedDate === dateStr ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              {/* Analytics Content moved from Analyst page */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-3">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-600" />
                    Last 7 Days Trend
                  </h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[... (stats?.weekly || [])].reverse().slice(-7)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(str) => format(parseISO(str), 'MMM d')}
                          tick={{ fontSize: 10, fill: '#94a3b8' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fill: '#94a3b8' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          labelFormatter={(str) => format(parseISO(str), 'MMMM d, yyyy')}
                        />
                        <Bar dataKey="files" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            </motion.div>
          ) : view === 'personal-records' && hasPermission('personal-records') ? (
            <motion.div 
              key="personal-records"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <Card className="lg:col-span-3">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-indigo-600" />
                    Personal Records
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total {stats?.overall.unit || 'Files'} Scanned</span>
                    {(!stats || stats.mode !== 'personal') ? (
                      <div className="h-9 w-24 bg-slate-200 animate-pulse rounded-lg mt-1" />
                    ) : (
                      <span className="text-3xl font-bold text-slate-900">{stats?.overall.total_files?.toLocaleString()}</span>
                    )}
                  </div>
                  <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block mb-1">Total Pages Scanned</span>
                    {(!stats || stats.mode !== 'personal') ? (
                      <div className="h-9 w-24 bg-indigo-200 animate-pulse rounded-lg mt-1" />
                    ) : (
                      <span className="text-3xl font-bold text-indigo-900">{stats?.overall.total_pages?.toLocaleString()}</span>
                    )}
                  </div>
                  <div className="p-6 bg-orange-50 rounded-2xl border border-orange-100">
                    <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider block mb-1">EP</span>
                    {(!stats || stats.mode !== 'personal') ? (
                      <div className="h-9 w-24 bg-orange-200 animate-pulse rounded-lg mt-1" />
                    ) : (
                      <span className="text-3xl font-bold text-orange-900">
                        {stats.monthly?.reduce((sum, m) => sum + (m.extra_pages || 0), 0).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ) : view === 'admin-data-entry' && hasPermission('admin-data-entry') ? (
            <motion.div 
              key="admin-data-entry"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <Card>
                {/* View Header with globally shared configuration */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2 text-indigo-900">
                      <Users className="w-5 h-5 text-indigo-600" />
                      Daily Data Entry Wizard
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Select date and operator to fill scanning progress and Mouzas</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative h-[42px]">
                      <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="date" 
                        value={adminDate}
                        onChange={(e) => setAdminDate(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 h-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <button 
                      onClick={() => saveAdminData()}
                      disabled={isSaving}
                      className="bg-indigo-600 text-white px-6 h-[42px] rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20"
                    >
                      {isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Save All Progress</>}
                    </button>
                    <button 
                      onClick={downloadSkippedYearsCSV}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 h-[42px] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/10 cursor-pointer"
                      title="Download Excel CSV containing Mouzas existing and skipped years"
                    >
                      <Download className="w-4 h-4" />
                      Download Mouza CSV (2007)
                    </button>
                    <button 
                      onClick={downloadSkippedYearsPDF}
                      className="bg-teal-600 hover:bg-teal-700 text-white px-4 h-[42px] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-teal-500/10 cursor-pointer"
                      title="Download PDF report containing Mouzas existing and skipped years"
                    >
                      <FileText className="w-4 h-4" />
                      Download Mouza PDF (2007)
                    </button>
                  </div>
                </div>

                {saveMessage && (
                  <div className={cn(
                    "mb-6 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2",
                    saveMessage.type === 'success' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
                  )}>
                    {saveMessage.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    {saveMessage.text}
                  </div>
                )}

                {showCompletionMessage ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gradient-to-br from-indigo-50 to-emerald-50 border border-indigo-100 rounded-2xl p-8 text-center my-6"
                  >
                    <div className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center text-white text-2xl mx-auto mb-4 shadow-md">
                      🎉
                    </div>
                    <h4 className="text-xl font-bold text-slate-800">All Operators Completed!</h4>
                    <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
                      All operators data and scanned Mouzas for this date have been filled and synchronized safely with the server.
                    </p>
                    <div className="mt-6 flex justify-center gap-4">
                      <button
                        onClick={() => {
                          setShowCompletionMessage(false);
                          setSelectedOperatorIndex(0);
                        }}
                        className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-5 py-2 rounded-xl text-xs font-bold transition-all"
                      >
                        Start From Operator 1
                      </button>
                      <button
                        onClick={() => setView('mouza-details')}
                        className="bg-indigo-600 text-white hover:bg-indigo-700 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-200"
                      >
                        View Mouza Details
                      </button>
                    </div>
                  </motion.div>
                ) : adminData.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 font-medium">
                    No active operators registered for this site. Add operators in the "Operators" tab.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Operator quick-selection grid / chip list */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                        Active Operators List (Click to select)
                      </label>
                      <div className="flex flex-wrap gap-2.5">
                        {adminData.map((item, index) => {
                          const isCurrent = index === selectedOperatorIndex;
                          const hasData = (item.files !== null && item.files > 0) || (item.pages !== null && item.pages > 0) || (item.mouzas && item.mouzas.length > 0);
                          const mouzasCount = item.mouzas?.length || 0;
                          return (
                            <button
                              type="button"
                              key={item.employee_id}
                              onClick={() => {
                                setSelectedOperatorIndex(index);
                                setShowCompletionMessage(false);
                              }}
                              className={cn(
                                "px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border",
                                isCurrent 
                                  ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200" 
                                  : hasData 
                                    ? "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100" 
                                    : "bg-white text-slate-400 border-dashed border-slate-200 hover:bg-slate-50"
                              )}
                            >
                              <span className={cn(
                                "w-2 h-2 rounded-full",
                                hasData ? "bg-emerald-500" : "bg-slate-300"
                              )} />
                              <span>{item.name}</span>
                              {mouzasCount > 0 && (
                                <span className={cn(
                                  "text-[9px] px-1.5 py-0.5 rounded-full font-bold",
                                  isCurrent ? "bg-indigo-500 text-white" : "bg-indigo-100 text-indigo-800"
                                )}>
                                  {mouzasCount} m
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Active Operator Detail Entry section */}
                    {adminData[selectedOperatorIndex] && (
                      <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-6 space-y-6 mt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 text-sm font-bold border border-indigo-100">
                              {selectedOperatorIndex + 1}
                            </div>
                            <div>
                              <h4 className="text-base font-bold text-slate-800">
                                {adminData[selectedOperatorIndex].name}
                              </h4>
                              {!adminData[selectedOperatorIndex].is_active && (
                                <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded uppercase">Inactive</span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-slate-400 font-bold">
                            Operator Progress: {selectedOperatorIndex + 1} of {adminData.length}
                          </span>
                        </div>

                        {/* General stats input */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">
                              Scanned {stats?.overall.unit || 'Files'}
                            </label>
                            <input 
                              type="number" 
                              value={adminData[selectedOperatorIndex].files === null ? '' : adminData[selectedOperatorIndex].files}
                              onChange={(e) => handleAdminChange(adminData[selectedOperatorIndex].employee_id, 'files', e.target.value)}
                              placeholder="0"
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">
                              Scanned Pages
                            </label>
                            <input 
                              type="number" 
                              value={adminData[selectedOperatorIndex].pages === null ? '' : adminData[selectedOperatorIndex].pages}
                              onChange={(e) => handleAdminChange(adminData[selectedOperatorIndex].employee_id, 'pages', e.target.value)}
                              placeholder="0"
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                            />
                          </div>
                        </div>

                        {/* Scanned Mouzas detail section */}
                        <div className="border-t border-slate-100 pt-6 mt-4">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h5 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <Globe className="w-4 h-4 text-indigo-500" />
                                Scanned Mouzas Details
                              </h5>
                              <p className="text-[11px] text-slate-400 mt-1">Specify which Mouzas and Register Types (multiple years option allowed) were processed by this operator</p>
                            </div>
                            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                              {copyFeedback && (
                                <span className={cn(
                                  "text-xs font-bold px-2.5 py-1 rounded-lg border",
                                  copyFeedback.startsWith("Success")
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                    : "bg-slate-550 bg-amber-50 text-amber-700 border-amber-100"
                                )}>
                                  {copyFeedback}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={handlePicLastMouzas}
                                disabled={isCopyingLastMouzas}
                                className="bg-slate-150 text-slate-700 hover:bg-slate-200 disabled:opacity-50 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-250 shrink-0"
                                title="Pick the last scanned Mouza structure, names and record types processed by this operator"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                {isCopyingLastMouzas ? "Copying..." : "Pic Last Mouzas"}
                              </button>
                              <button
                                type="button"
                                onClick={handleAddMouzaToCurrentOperator}
                                className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-indigo-100 shrink-0"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Add New Mouza
                              </button>
                            </div>
                          </div>

                          {(() => {
                            const rawMouzas = adminData[selectedOperatorIndex]?.mouzas || [];
                            // Let's group rawMouzas by groupId, fallback to name, preserving original appearance order
                            const groupedMouzas: Array<{ name: string; groupId: string; indices: number[]; entries: Array<{ originalIndex: number; record: MouzaEntry }> }> = [];

                            rawMouzas.forEach((record, originalIndex) => {
                              const name = record.name || '';
                              const groupId = record.groupId || `g_fallback_${name.trim().toLowerCase() || 'unnamed'}`;
                              let group = groupedMouzas.find(g => g.groupId === groupId);
                              if (!group) {
                                group = { name, groupId, indices: [], entries: [] };
                                groupedMouzas.push(group);
                              }
                              group.indices.push(originalIndex);
                              group.entries.push({ originalIndex, record });
                            });

                            if (groupedMouzas.length === 0) {
                              return (
                                <div className="bg-white border border-dashed border-slate-200 rounded-xl p-8 text-center text-xs text-slate-400 font-medium">
                                  No Mouzas added yet for this operator. Click the "+ Add New Mouza" button above to register a Mouza.
                                </div>
                              );
                            }

                            return (
                              <div className="space-y-6">
                                {groupedMouzas.map((group, gIdx) => {
                                  const groupTotalQty = group.entries.reduce((sum, e) => sum + (Number(e.record.quantity) || 0), 0);
                                  return (
                                    <div 
                                      key={gIdx} 
                                      className="bg-white border border-slate-200 rounded-2xl p-5 relative shadow-sm hover:shadow transition-shadow"
                                    >
                                      {/* Group Header: Mouza Name Input & Actions & Mouza-level Status */}
                                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-100">
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:max-w-xl">
                                          <div className="flex items-center gap-2 w-full sm:max-w-md">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shrink-0">
                                              <Map className="w-4 h-4" />
                                            </div>
                                            <input 
                                              type="text"
                                              placeholder="Enter Mouza Name..."
                                              value={group.name}
                                              onChange={(e) => handleRenameMouzaGroup(group.indices, e.target.value)}
                                              list="mouza-suggestions-all"
                                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                            />
                                            <datalist id="mouza-suggestions-all">
                                              {Array.from(new Set(mouzasData.map(m => m.name))).filter(Boolean).map((name, mIdx) => (
                                                <option key={mIdx} value={name} />
                                              ))}
                                            </datalist>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => handleAddRowToMouzaGroup(group.groupId, group.name)}
                                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors border border-indigo-100"
                                            title="Add extra years or register row for this Mouza"
                                          >
                                            <Plus className="w-3.5 h-3.5" />
                                            Add Year / Type Register
                                          </button>
                                          
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveMouzaGroup(group.indices)}
                                            className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                            title="Delete entire Mouza block and all its years records"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>

                                      {/* List of Registry rows (multiple years, types) under this Mouza */}
                                      <div className="space-y-4">
                                        {group.entries.map(({ originalIndex, record: m }, rIdx) => (
                                          <div 
                                            key={originalIndex} 
                                            className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end bg-slate-50/50 border border-slate-100 p-4 rounded-xl relative pr-10"
                                          >
                                            {/* Delete single register row */}
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveMouza(originalIndex)}
                                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 p-1.5 rounded-md hover:bg-slate-100/50 transition-all"
                                              title="Delete this years record"
                                              disabled={group.entries.length <= 1}
                                            >
                                              <X className="w-4 h-4" />
                                            </button>

                                            {/* Register Type */}
                                            <div className="md:col-span-5">
                                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                                Register Type
                                              </label>
                                              <select
                                                value={m.type}
                                                onChange={(e) => handleUpdateMouzaField(originalIndex, 'type', e.target.value as any)}
                                                className="w-full bg-white border border-slate-250 rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
                                              >
                                                <option value="RHZ">RHZ</option>
                                                <option value="Mutation">Mutation</option>
                                                <option value="Shajra">Shajra</option>
                                              </select>
                                            </div>

                                            {/* Register Years Range */}
                                            <div className="md:col-span-4">
                                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                                Years Range (e.g. 1999-2000)
                                              </label>
                                              <input 
                                                type="text"
                                                placeholder="e.g. 2002 - 2003"
                                                value={m.years}
                                                onChange={(e) => handleUpdateMouzaField(originalIndex, 'years', e.target.value)}
                                                className="w-full bg-white border border-slate-250 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/10 font-mono"
                                              />
                                            </div>

                                            {/* Quantity */}
                                            <div className="md:col-span-3">
                                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 text-center font-semibold">
                                                Qty (Registers)
                                              </label>
                                              <input 
                                                type="number"
                                                min="1"
                                                placeholder="1"
                                                value={m.quantity === 0 ? '' : (m.quantity ?? '')}
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  if (val === '') {
                                                    handleUpdateMouzaField(originalIndex, 'quantity', '');
                                                  } else {
                                                    const parsed = parseInt(val, 10);
                                                    handleUpdateMouzaField(originalIndex, 'quantity', isNaN(parsed) ? '' : parsed);
                                                  }
                                                }}
                                                className="w-full bg-white border border-slate-250 rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/10 font-mono text-center"
                                              />
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Action buttons footer for wizard */}
                        <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold">
                            <span>Operator:</span>
                            <span className="text-slate-600 font-extrabold">{selectedOperatorIndex + 1}</span>
                            <span>of</span>
                            <span className="text-slate-600 font-extrabold">{adminData.length}</span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={async () => {
                                const ok = await saveAdminData();
                                if (ok) {
                                  // Just show inline saved indicator
                                }
                              }}
                              disabled={isSaving}
                              className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-5 h-10 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
                            >
                              <Save className="w-4 h-4 text-slate-400" />
                              Save Current Progress
                            </button>

                            <button
                              type="button"
                              onClick={handleSaveAndNextOperator}
                              disabled={isSaving}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 h-10 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-indigo-100"
                            >
                              {selectedOperatorIndex === adminData.length - 1 ? (
                                <>
                                  {isSaving ? 'Finishing...' : 'Save & Finish'}
                                  <Check className="w-4 h-4" />
                                </>
                              ) : (
                                <>
                                  {isSaving ? 'Saving...' : 'Save & Next Operator'}
                                  <ChevronRight className="w-4 h-4" />
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>

              {/* Mouza Scanning Status Board Section */}
              {(() => {
                const inScanningList = mouzasData.filter(m => m.status !== 'Complete');
                const completedList = mouzasData.filter(m => m.status === 'Complete');

                return (
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                      <div>
                        <h4 className="text-base font-extrabold text-indigo-900 flex items-center gap-2">
                          <Globe className="w-5 h-5 text-indigo-600" />
                          Mouza Scanning Status Board
                        </h4>
                        <p className="text-xs text-slate-400 mt-1">Manage and track whether a Mouza's overall scanning process is In Progress or Completed</p>
                      </div>
                      <div className="bg-slate-50 border border-slate-150 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-500 flex items-center gap-1.5 self-start sm:self-center">
                        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                        <span>{mouzasData.length} Total Mouzas</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left Column: In Scanning List */}
                      <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 space-y-4">
                        <h5 className="text-xs font-black text-amber-600 uppercase tracking-wider flex items-center gap-1.5 pl-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                          ⏳ In Scanning ({inScanningList.length})
                        </h5>
                        <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto pr-2 space-y-2">
                          {inScanningList.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400 font-bold bg-white border border-slate-100 rounded-2xl">
                              No Mouzas in Scanning status.
                            </div>
                          ) : (
                            inScanningList.map((m) => {
                              const isUpdating = updatingMouzaStatusName === m.name;
                              const regCount = (m.RHZ?.length || 0) + (m.Mutation?.length || 0) + (m.Shajra?.length || 0);
                              return (
                                <div key={m.name} className="py-3 px-4 bg-white border border-slate-100 rounded-xl flex items-center justify-between gap-3 shadow-xs hover:border-slate-200 transition-colors">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-extrabold text-slate-800">{m.name}</span>
                                    <span className="text-[10px] text-slate-400 font-bold mt-0.5 font-mono">
                                      {regCount} Registers entered
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleSetMouzaStatus(m.name, 'Complete')}
                                    disabled={isUpdating}
                                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 px-3 h-8 rounded-xl text-xs font-bold transition-colors border border-emerald-150 flex items-center gap-1 disabled:opacity-50 shrink-0 cursor-pointer"
                                  >
                                    {isUpdating ? "..." : (
                                      <>
                                        <Check className="w-3.5 h-3.5" />
                                        Complete
                                      </>
                                    )}
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Right Column: Completed List */}
                      <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 space-y-4">
                        <h5 className="text-xs font-black text-emerald-600 uppercase tracking-wider flex items-center gap-1.5 pl-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          ✅ Completed ({completedList.length})
                        </h5>
                        <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto pr-2 space-y-2">
                          {completedList.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400 font-bold bg-white border border-slate-100 rounded-2xl">
                              No Mouzas marked as Completed yet.
                            </div>
                          ) : (
                            completedList.map((m) => {
                              const isUpdating = updatingMouzaStatusName === m.name;
                              const regCount = (m.RHZ?.length || 0) + (m.Mutation?.length || 0) + (m.Shajra?.length || 0);
                              return (
                                <div key={m.name} className="py-3 px-4 bg-white border border-slate-100 rounded-xl flex items-center justify-between gap-3 shadow-xs hover:border-slate-200 transition-colors">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-extrabold text-slate-505 line-through">{m.name}</span>
                                    <span className="text-[10px] text-slate-400 font-bold mt-0.5 font-mono">
                                      {regCount} Registers entered
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleSetMouzaStatus(m.name, 'In Scanning')}
                                    disabled={isUpdating}
                                    className="bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 px-3 h-8 rounded-xl text-xs font-bold transition-colors border border-amber-150 flex items-center gap-1 disabled:opacity-50 shrink-0 cursor-pointer"
                                  >
                                    {isUpdating ? "..." : (
                                      <>
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Undo
                                      </>
                                    )}
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          ) : view === 'mouza-details' && hasPermission('mouza-details') ? (
            <motion.div 
              key="mouza-details"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <Globe className="w-8 h-8 text-indigo-600" />
                    Mouza Registry Details
                  </h2>
                  <p className="text-slate-500 font-medium text-sm mt-1">Detailed year-wise records of RHZ, Mutation, and Shajra registers scanned for each Mouza</p>
                </div>
              </div>

              {/* Global Mouza Stats Summary Cards */}
              {(() => {
                let globalTotalRHZ = 0;
                let globalTotalMutation = 0;
                let globalTotalShajra = 0;
                let scannedMouzasCount = 0;
                let inScanningMouzasCount = 0;

                mouzasData.forEach(m => {
                  const RHZList = m.RHZ || [];
                  const MutationList = m.Mutation || [];
                  const ShajraList = m.Shajra || [];
                  const allRegs = [...RHZList, ...MutationList, ...ShajraList];
                  const isComplete = allRegs.length > 0 && allRegs.every((r: any) => r.status === 'Complete');
                  if (allRegs.length > 0 && isComplete) {
                    scannedMouzasCount++;
                  } else {
                    inScanningMouzasCount++;
                  }
                  
                  RHZList.forEach((r: any) => {
                    globalTotalRHZ += (Number(r.quantity) || 1);
                  });
                  MutationList.forEach((r: any) => {
                    globalTotalMutation += (Number(r.quantity) || 1);
                  });
                  ShajraList.forEach((r: any) => {
                    globalTotalShajra += (Number(r.quantity) || 1);
                  });
                });

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Scanned Mouzas */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow transition-shadow">
                      <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/50">
                        <Check className="w-5.5 h-5.5" />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Scanned Mouzas</span>
                        <span className="text-2xl font-black text-slate-800 font-mono leading-none block mt-1.5">{scannedMouzasCount}</span>
                      </div>
                    </div>

                    {/* In Scanning Mouzas */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow transition-shadow">
                      <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100/50">
                        <Map className="w-5.5 h-5.5" />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">In Scanning Mouzas</span>
                        <span className="text-2xl font-black text-slate-800 font-mono leading-none block mt-1.5">{inScanningMouzasCount}</span>
                      </div>
                    </div>

                    {/* Total RHZ */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow transition-shadow">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/50">
                        <Layers className="w-5.5 h-5.5 text-blue-600" />
                      </div>
                      <div>
                        <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider block">Total RHZ</span>
                        <span className="text-2xl font-black text-slate-800 font-mono leading-none block mt-1.5">{globalTotalRHZ}</span>
                      </div>
                    </div>

                    {/* Total Mutation */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow transition-shadow">
                      <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100/50">
                        <FileText className="w-5.5 h-5.5 text-amber-600" />
                      </div>
                      <div>
                        <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider block">Total Mutation</span>
                        <span className="text-2xl font-black text-slate-800 font-mono leading-none block mt-1.5">{globalTotalMutation}</span>
                      </div>
                    </div>

                    {/* Total Shajra */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:shadow transition-shadow">
                      <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/50">
                        <Globe className="w-5.5 h-5.5 text-emerald-600" />
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block">Total Shajra</span>
                        <span className="text-2xl font-black text-slate-800 font-mono leading-none block mt-1.5">{globalTotalShajra}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Filters & Search Card with Top Mouza Selector Dropdown */}
              <Card className="p-5 flex flex-col md:flex-row items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:max-w-2xl">
                  {/* Select Mouza Dropdown Column */}
                  <div className="relative shrink-0 sm:w-64">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 pl-1">
                      Choose Mouza to View
                    </label>
                    <select
                      value={selectedMouzaFilter}
                      onChange={(e) => setSelectedMouzaFilter(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer"
                    >
                      <option value="all">📁 All Mouzas (View All)</option>
                      {mouzasData.map((m) => (
                        <option key={m.name} value={m.name}>
                          🗺️ {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Search Input Column */}
                  <div className="w-full">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 pl-1">
                      Search Mouza Name
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search Mouza by name..."
                        value={mouzaSearch}
                        onChange={(e) => setMouzaSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-400 font-bold flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-100 self-end sm:self-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
                  <span>
                    Showing filtered: {mouzasData.filter(m => {
                      if (selectedMouzaFilter !== 'all' && m.name !== selectedMouzaFilter) return false;
                      if (mouzaSearch && !m.name.toLowerCase().includes(mouzaSearch.toLowerCase())) return false;
                      return true;
                    }).length} of {mouzasData.length}
                  </span>
                </div>
              </Card>

              {mouzasLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="animate-pulse bg-white border border-slate-150 rounded-2xl p-6 space-y-4">
                      <div className="h-6 bg-slate-200 rounded-lg w-1/3" />
                      <div className="grid grid-cols-3 gap-3">
                        <div className="h-20 bg-slate-100 rounded-xl" />
                        <div className="h-20 bg-slate-100 rounded-xl" />
                        <div className="h-20 bg-slate-100 rounded-xl" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : mouzasData.length === 0 ? (
                <div className="bg-white border border-slate-150 rounded-2xl p-12 text-center">
                  <Globe className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h4 className="text-base font-bold text-slate-700">No Mouzas Scanned</h4>
                  <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto">No custom Mouzas or registers scanning data have been saved yet for this Site.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-8">
                  {mouzasData
                    .filter(m => {
                      if (selectedMouzaFilter !== 'all' && m.name !== selectedMouzaFilter) return false;
                      if (mouzaSearch && !m.name.toLowerCase().includes(mouzaSearch.toLowerCase())) return false;
                      return true;
                    })
                    .map((mouza) => {
                      const RHZList = mouza.RHZ || [];
                      const MutationList = mouza.Mutation || [];
                      const ShajraList = mouza.Shajra || [];
                      const allRegs = [...RHZList, ...MutationList, ...ShajraList];

                      const totalRHZQty = RHZList.reduce((s: number, r: any) => s + (Number(r.quantity) || 0), 0);
                      const totalMutationQty = MutationList.reduce((s: number, r: any) => s + (Number(r.quantity) || 0), 0);
                      const totalShajraQty = ShajraList.reduce((s: number, r: any) => s + (Number(r.quantity) || 0), 0);
                      const totalQty = totalRHZQty + totalMutationQty + totalShajraQty;

                      const isComplete = allRegs.length > 0 && allRegs.every((r: any) => r.status === 'Complete');

                      // Extract and sort all unique years
                      const allYearsSet = new Set<string>();
                      RHZList.forEach((r: any) => { if (r.years) allYearsSet.add(r.years.trim()); });
                      MutationList.forEach((r: any) => { if (r.years) allYearsSet.add(r.years.trim()); });
                      ShajraList.forEach((r: any) => { if (r.years) allYearsSet.add(r.years.trim()); });
                      
                      const sortedYears = Array.from(allYearsSet).sort((a, b) => {
                        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
                      });

                      return (
                        <div 
                          key={mouza.name}
                          className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all group duration-300"
                        >
                          <div>
                            {/* Mouza Title Header with Consolidated Status Badge next to its name */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100/50">
                                  <Map className="w-5 h-5" />
                                </div>
                                <div className="flex items-center gap-2.5">
                                  <h3 className="text-lg font-black text-slate-800 tracking-tight group-hover:text-indigo-900 transition-colors">
                                    {mouza.name}
                                  </h3>
                                  <span className={cn(
                                    "px-2.5 py-0.5 rounded-full text-[10px] font-extrabold inline-flex items-center gap-1 border shadow-2xs",
                                    isComplete
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-150" 
                                      : "bg-amber-50 text-amber-700 border-amber-150"
                                  )}>
                                    <span className={cn(
                                      "w-1.5 h-1.5 rounded-full",
                                      isComplete ? "bg-emerald-500" : "bg-amber-550 animate-pulse"
                                    )} />
                                    {isComplete ? 'Complete' : 'Scanning'}
                                  </span>
                                </div>
                              </div>
                              <span className="bg-indigo-50/80 text-indigo-700 border border-indigo-105/40 text-[10px] uppercase font-extrabold px-3 py-1 rounded-xl flex items-center gap-1.5 self-start sm:self-center">
                                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                                <span>{totalQty} registers total</span>
                              </span>
                            </div>

                            {/* Complete and In Scanning Numbers Sub-bar renamed to represent Shajra, Mutation and RHZ */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 mt-2 bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                              <div className="text-center sm:text-left sm:pl-4">
                                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block leading-none">Total Registers</span>
                                <span className="text-xl font-black text-slate-800 font-mono mt-1.5 block">{totalQty}</span>
                              </div>
                              <div className="border-l border-slate-200 text-center sm:text-left sm:pl-4">
                                <span className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-widest block leading-none">Total RHZ</span>
                                <span className="text-xl font-black text-emerald-700 font-mono mt-1.5 block">Q: {totalRHZQty}</span>
                              </div>
                              <div className="border-l border-slate-200 text-center sm:text-left sm:pl-4">
                                <span className="text-[10px] text-amber-500 font-extrabold uppercase tracking-widest block leading-none">Total Mutation</span>
                                <span className="text-xl font-black text-amber-700 font-mono mt-1.5 block">Q: {totalMutationQty}</span>
                              </div>
                              <div className="border-l border-slate-200 text-center sm:text-left sm:pl-4">
                                <span className="text-[10px] text-indigo-550 font-extrabold uppercase tracking-widest block leading-none">Total Shajra</span>
                                <span className="text-xl font-black text-indigo-755 font-mono mt-1.5 block">Q: {totalShajraQty}</span>
                              </div>
                            </div>

                            {/* Consolidated Aligned Table showing just numbers, no operator details or Scanning status */}
                            {sortedYears.length === 0 ? (
                              <div className="text-center py-6 text-xs text-slate-400 font-bold bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                                No records of registry types defined yet.
                              </div>
                            ) : (
                              <div className="overflow-x-auto rounded-2xl border border-slate-150 bg-white shadow-xs">
                                <table className="min-w-full divide-y divide-slate-150 text-center">
                                  <thead className="bg-slate-50/75">
                                    <tr>
                                      <th className="py-3 px-4 text-xs font-black text-slate-500 uppercase tracking-wider text-left pl-6">Year</th>
                                      <th className="py-3 px-4 text-xs font-black text-slate-500 uppercase tracking-wider">RHZ</th>
                                      <th className="py-3 px-4 text-xs font-black text-slate-500 uppercase tracking-wider">Mutation</th>
                                      <th className="py-3 px-4 text-xs font-black text-slate-500 uppercase tracking-wider">Shajra</th>
                                      <th className="py-3 px-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right pr-6">Total Registers</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 bg-white">
                                    {sortedYears.map((year) => {
                                      const rhzRec = RHZList.find((r: any) => r.years.trim().toLowerCase() === year.toLowerCase());
                                      const mutRec = MutationList.find((r: any) => r.years.trim().toLowerCase() === year.toLowerCase());
                                      const shajRec = ShajraList.find((r: any) => r.years.trim().toLowerCase() === year.toLowerCase());
                                      const rowTotal = (rhzRec?.quantity || 0) + (mutRec?.quantity || 0) + (shajRec?.quantity || 0);

                                      return (
                                        <tr key={year} className="hover:bg-slate-50/30 transition-colors">
                                          <td className="py-4 px-4 text-sm font-extrabold text-slate-800 font-mono text-left pl-6">{year}</td>
                                          <td className="py-4 px-4 text-xs font-semibold">
                                            {rhzRec ? (
                                              <span className="bg-slate-105/60 border border-slate-150 text-slate-700 px-3 py-1 rounded-lg font-mono font-bold text-sm">
                                                {rhzRec.quantity || 1}
                                              </span>
                                            ) : (
                                              <span className="text-slate-300 font-bold">-</span>
                                            )}
                                          </td>
                                          <td className="py-4 px-4 text-xs font-semibold">
                                            {mutRec ? (
                                              <span className="bg-slate-105/60 border border-slate-150 text-slate-700 px-3 py-1 rounded-lg font-mono font-bold text-sm">
                                                {mutRec.quantity || 1}
                                              </span>
                                            ) : (
                                              <span className="text-slate-300 font-bold">-</span>
                                            )}
                                          </td>
                                          <td className="py-4 px-4 text-xs font-semibold">
                                            {shajRec ? (
                                              <span className="bg-slate-105/60 border border-slate-150 text-slate-700 px-3 py-1 rounded-lg font-mono font-bold text-sm">
                                                {shajRec.quantity || 1}
                                              </span>
                                            ) : (
                                              <span className="text-slate-300 font-bold">-</span>
                                            )}
                                          </td>
                                          <td className="py-4 px-4 text-sm font-black font-mono text-slate-700 text-right pr-6">
                                            <span className="bg-indigo-50/50 text-indigo-700 px-3 py-1 rounded-xl border border-indigo-100">
                                              {rowTotal}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}

                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </motion.div>
          ) : view === 'admin-reports' && hasPermission('admin-reports') ? (
            <motion.div 
              key="admin-reports"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <Card>
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Download className="w-5 h-5 text-orange-600" />
                    Downloads
                  </h3>
                </div>
                
                <div className="max-w-2xl mx-auto space-y-6">
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between mb-4 pb-4 border-b border-indigo-100/50">
                        <h4 className="font-bold text-slate-900 uppercase text-xs tracking-wider">Export Settings</h4>
                        
                        <div className="flex bg-slate-200/60 p-0.5 rounded-lg text-xs font-semibold">
                          <button
                            type="button"
                            onClick={() => setExportType('month')}
                            className={cn(
                              "px-2.5 py-1 rounded-md transition-all",
                              exportType === 'month' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                            )}
                          >
                            Month-wise
                          </button>
                          <button
                            type="button"
                            onClick={() => setExportType('range')}
                            className={cn(
                              "px-2.5 py-1 rounded-md transition-all",
                              exportType === 'range' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                            )}
                          >
                            Custom Range
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {exportType === 'month' ? (
                          <>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-sm font-medium text-slate-600">Select Month:</span>
                              <input 
                                type="month" 
                                value={exportMonth}
                                onChange={(e) => setExportMonth(e.target.value)}
                                className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 text-slate-700 outline-none"
                              />
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-sm font-medium text-slate-600">Extra Pages:</span>
                              <div className="flex items-center gap-2">
                                <span className="bg-orange-50 text-orange-700 px-4 py-2 rounded-xl text-sm font-bold border border-orange-100">
                                  {stats?.monthly.find(m => m.month === exportMonth)?.extra_pages || 0}
                                </span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-sm font-medium text-slate-600">From Date:</span>
                              <input 
                                type="date" 
                                value={exportStartDate}
                                onChange={(e) => setExportStartDate(e.target.value)}
                                className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 text-slate-700 outline-none"
                              />
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-sm font-medium text-slate-600">To Date:</span>
                              <input 
                                type="date" 
                                value={exportEndDate}
                                onChange={(e) => setExportEndDate(e.target.value)}
                                className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 text-slate-700 outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <button 
                        onClick={() => downloadReport('personal')}
                        disabled={isDownloading !== null}
                        className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all group disabled:opacity-60"
                      >
                        {isDownloading === 'personal' ? (
                          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2" />
                        ) : (
                          <FileText className="w-8 h-8 text-slate-400 mb-2 group-hover:text-indigo-600 transition-colors" />
                        )}
                        <span className="text-sm font-bold text-slate-700">{isDownloading === 'personal' ? 'Downloading...' : 'Personal Sheet'}</span>
                        <span className="text-[10px] text-slate-400 uppercase mt-1">Excel Format</span>
                      </button>
                      <button 
                        onClick={() => downloadReport('main')}
                        disabled={isDownloading !== null}
                        className="flex flex-col items-center justify-center p-6 bg-indigo-600 rounded-2xl hover:bg-indigo-700 transition-all group shadow-lg shadow-indigo-500/20 disabled:opacity-60"
                      >
                        {isDownloading === 'main' ? (
                          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mb-2" />
                        ) : (
                          <Download className="w-8 h-8 text-white/80 mb-2 group-hover:text-white transition-colors" />
                        )}
                        <span className="text-sm font-bold text-white">{isDownloading === 'main' ? 'Downloading...' : 'Main Sheet'}</span>
                        <span className="text-[10px] text-white/60 uppercase mt-1">Excel Format</span>
                      </button>
                      <button 
                        onClick={downloadPDFReport}
                        className="flex flex-col items-center justify-center p-6 bg-rose-600 rounded-2xl hover:bg-rose-700 text-white transition-all group shadow-lg shadow-rose-550/20"
                      >
                        <Layers className="w-8 h-8 text-rose-200 mb-2 group-hover:text-white transition-colors" />
                        <span className="text-sm font-bold">PDF Summary</span>
                        <span className="text-[10px] text-rose-200 uppercase mt-1">Multan Scanning</span>
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>
          ) : view === 'admin-sites' && hasPermission('admin-sites') ? (
            <motion.div 
              key="admin-sites"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="border-indigo-100 bg-indigo-50/30">
                  <h4 className="font-bold mb-4 flex items-center gap-2 text-indigo-900">
                    <Plus className="w-4 h-4" /> Add New Site
                  </h4>
                  <div className="space-y-4">
                    <input 
                      type="text" 
                      placeholder="Site Name (e.g. Islamabad)"
                      value={newSiteName}
                      onChange={(e) => setNewSiteName(e.target.value)}
                      className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <input 
                      type="number" 
                      placeholder={`Target ${stats?.overall.unit || 'Files'}`}
                      value={newSiteTarget}
                      onChange={(e) => setNewSiteTarget(e.target.value)}
                      className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-indigo-400 uppercase ml-1">Rate (Rs)</label>
                        <input 
                          type="number" 
                          step="0.001"
                          placeholder="Rate"
                          value={newSiteRate}
                          onChange={(e) => setNewSiteRate(e.target.value)}
                          className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-indigo-400 uppercase ml-1">Unit Label</label>
                        <input 
                          type="text" 
                          placeholder="Files/Registers"
                          value={newSiteUnit}
                          onChange={(e) => setNewSiteUnit(e.target.value)}
                          className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-indigo-400 uppercase ml-1">Default Extra Pages (Daily)</label>
                      <input 
                        type="number" 
                        placeholder="Default Extra Pages"
                        value={newSiteDefaultExtraPages}
                        onChange={(e) => setNewSiteDefaultExtraPages(e.target.value)}
                        className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 font-bold"
                      />
                    </div>
                    <button 
                      onClick={handleAddSite}
                      className="w-full bg-indigo-600 text-white py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all"
                    >
                      Create Site
                    </button>
                  </div>
                </Card>

                <Card className="lg:col-span-2 border-slate-200 bg-white">
                  <h4 className="font-bold mb-4 flex items-center gap-2 text-slate-900">
                    <LayoutDashboard className="w-4 h-4 text-indigo-600" /> Site Overview
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-400 font-medium border-b border-black/5">
                          <th className="text-left pb-3">Site Name</th>
                          <th className="text-right pb-3">Rate</th>
                          <th className="text-right pb-3">Unit</th>
                          <th className="text-right pb-3 text-indigo-500">Default EP</th>
                          <th className="text-right pb-3 text-orange-600">Total EP</th>
                          <th className="text-right pb-3">Total Scanned</th>
                          <th className="text-right pb-3">Total Pages</th>
                          <th className="text-right pb-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5">
                        {sitesSummary.map((site) => (
                          <tr key={site.id} className="group hover:bg-slate-50 transition-colors">
                            <td className="py-4 font-medium text-slate-700">{site.name}</td>
                            <td className="py-2 text-right font-mono text-slate-600">
                              {isUpdatingSiteRate === site.id ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <input 
                                    type="number" 
                                    step="0.001"
                                    value={newSiteRateValue}
                                    onChange={(e) => setNewSiteRateValue(e.target.value)}
                                    className="w-16 bg-white border border-slate-200 rounded px-1.5 py-1 text-xs text-right outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                                    autoFocus
                                  />
                                  <button 
                                    onClick={() => updateSiteRate(site.id, parseFloat(newSiteRateValue) || 0)}
                                    className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                                    title="Save"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => setIsUpdatingSiteRate(null)}
                                    className="p-1.5 bg-slate-200 text-slate-600 rounded hover:bg-slate-300 transition"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1.5 min-h-[36px]">
                                  <span>
                                    {site.rate !== undefined && site.rate !== null 
                                      ? site.rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) 
                                      : '0.30'}
                                  </span>
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      setIsUpdatingSiteRate(site.id);
                                      setNewSiteRateValue(site.rate?.toString() || '0.30');
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                    title="Edit Rate"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="py-2 text-right text-slate-500 text-xs">
                              {isUpdatingSiteUnit === site.id ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <input 
                                    type="text" 
                                    value={newSiteUnitValue}
                                    onChange={(e) => setNewSiteUnitValue(e.target.value)}
                                    placeholder="Unit"
                                    className="w-20 bg-white border border-slate-200 rounded px-1.5 py-1 text-xs text-right outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                                    autoFocus
                                  />
                                  <button 
                                    onClick={() => updateSiteUnit(site.id, newSiteUnitValue || 'Files')}
                                    className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                                    title="Save"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => setIsUpdatingSiteUnit(null)}
                                    className="p-1.5 bg-slate-200 text-slate-600 rounded hover:bg-slate-300 transition"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1.5 min-h-[36px]">
                                  <span>{site.unit || 'Files'}</span>
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      setIsUpdatingSiteUnit(site.id);
                                      setNewSiteUnitValue(site.unit || 'Files');
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                    title="Edit Unit"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                            {/* Default EP inline configuration */}
                            <td className="py-2 text-right text-slate-500 text-xs">
                              {isUpdatingSiteDefaultEP === site.id ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <input 
                                    type="number" 
                                    value={newSiteDefaultEPValue}
                                    onChange={(e) => setNewSiteDefaultEPValue(e.target.value)}
                                    placeholder="0"
                                    className="w-16 bg-white border border-slate-200 rounded px-1.5 py-1 text-xs text-right outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                                    autoFocus
                                  />
                                  <button 
                                    onClick={() => updateSiteDefaultEP(site.id, parseInt(newSiteDefaultEPValue) || 0)}
                                    className="p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                                    title="Save"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => setIsUpdatingSiteDefaultEP(null)}
                                    className="p-1.5 bg-slate-200 text-slate-600 rounded hover:bg-slate-300 transition"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1.5 min-h-[36px]">
                                  <span className="font-bold text-indigo-600 font-mono">{site.default_extra_pages ?? 0}</span>
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      setIsUpdatingSiteDefaultEP(site.id);
                                      setNewSiteDefaultEPValue((site.default_extra_pages ?? 0).toString());
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                    title="Edit Default Extra Pages"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="py-4 text-right font-mono text-orange-600">{site.extra_pages?.toLocaleString() || '0'}</td>
                            <td className="py-4 text-right font-mono text-slate-600">{site.total_files?.toLocaleString() || '0'}</td>
                            <td className="py-4 text-right font-mono text-slate-600">{site.total_pages?.toLocaleString() || '0'}</td>
                            <td className="py-4 text-right">
                              {confirmDeleteSite === site.id ? (
                                <div className="flex justify-end gap-1">
                                  <button 
                                    onClick={() => handleDeleteSite(site.id)}
                                    className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded hover:bg-red-700"
                                  >
                                    Confirm
                                  </button>
                                  <button 
                                    onClick={() => setConfirmDeleteSite(null)}
                                    className="px-2 py-1 bg-slate-200 text-slate-600 text-[10px] font-bold rounded hover:bg-slate-300"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => setConfirmDeleteSite(site.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                                  title="Delete Site"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-slate-100">
                        <tr className="bg-slate-50/50 font-bold">
                          <td className="py-4 text-slate-900 pl-4">GRAND TOTAL</td>
                          <td className="py-4"></td>
                          <td className="py-4"></td>
                          <td className="py-4 text-right font-mono text-indigo-650">
                            {sitesSummary.reduce((sum, s) => sum + (s.default_extra_pages || 0), 0).toLocaleString()}
                          </td>
                          <td className="py-4 text-right font-mono text-orange-700">
                            {sitesSummary.reduce((sum, s) => sum + (s.extra_pages || 0), 0).toLocaleString()}
                          </td>
                          <td className="py-4 text-right font-mono text-slate-900">
                            {sitesSummary.reduce((sum, s) => sum + (s.total_files || 0), 0).toLocaleString()}
                          </td>
                          <td className="py-4 text-right font-mono text-slate-900">
                            {sitesSummary.reduce((sum, s) => sum + (s.total_pages || 0), 0).toLocaleString()}
                          </td>
                          <td className="py-4"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Card>
              </div>

              {/* Edit Specific Previous Dates Extra Pages */}
              <Card className="border-indigo-150 bg-slate-50/50 mt-8">
                <div>
                  <h4 className="font-bold flex items-center gap-2 text-indigo-900 text-sm md:text-base">
                    <Layers className="w-5 h-5 text-indigo-600" />
                    Edit Specific Previous Dates Extra Pages
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">Select any site and past date to view and update its custom daily extra pages.</p>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Select Site</label>
                    <select 
                      value={editPastSiteId}
                      onChange={(e) => setEditPastSiteId(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="">-- Choose a Site --</option>
                      {sitesSummary.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Select Date</label>
                    <input 
                      type="date" 
                      value={editPastDate}
                      onChange={(e) => setEditPastDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">
                      Extra Pages 
                      {isFetchingPastEP && <span className="text-indigo-600 text-[9px] uppercase ml-2 animate-pulse">(Loading...)</span>}
                    </label>
                    <input 
                      type="number" 
                      placeholder="EP Value"
                      value={editPastEPValue}
                      onChange={(e) => setEditPastEPValue(e.target.value)}
                      disabled={isFetchingPastEP}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 font-bold"
                    />
                  </div>

                  <div>
                    <button 
                      onClick={handleSavePastEP}
                      disabled={isSavingPastEP || isFetchingPastEP || !editPastSiteId}
                      className="w-full bg-indigo-600 text-white py-2 px-4 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 h-[38px] flex items-center justify-center gap-2 shadow md:shadow-indigo-550/10"
                    >
                      {isSavingPastEP ? 'Saving...' : 'Update Extra Pages'}
                    </button>
                  </div>
                </div>

                {pastEPMessage && (
                  <div className={`mt-4 px-4 py-2.5 rounded-xl text-xs font-medium ${
                    pastEPMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {pastEPMessage.text}
                  </div>
                )}
              </Card>
            </motion.div>
          ) : view === 'admin-operators' && hasPermission('admin-operators') ? (
            <motion.div 
              key="admin-operators"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <Card className="border-slate-200 bg-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h4 className="font-bold flex items-center gap-2 text-slate-900">
                    <Users className="w-4 h-4 text-indigo-600" /> Operator Performance & Earnings
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Month:</span>
                    <input 
                      type="month" 
                      value={operatorsMonth}
                      onChange={(e) => setOperatorsMonth(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 font-medium border-b border-black/5">
                        <th className="text-left pb-3">Operator Name</th>
                        <th className="text-left pb-3">Site</th>
                        <th className="text-right pb-3">Total {stats?.overall.unit || 'Files'}</th>
                        <th className="text-right pb-3">Total Pages</th>
                        <th className="text-right pb-3 text-emerald-600">Earnings (Rs)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {operatorsSummary.map((op) => {
                        const earnings = (op.total_pages || 0) * (op.rate || 0.3);
                        return (
                          <tr key={op.id} className="group hover:bg-slate-50 transition-colors">
                            <td className="py-4 font-medium text-slate-700">{op.name}</td>
                            <td className="py-4 text-slate-500 text-xs">{op.site_name}</td>
                            <td className="py-4 text-right font-mono text-slate-600">{op.total_files?.toLocaleString() || '0'}</td>
                            <td className="py-4 text-right font-mono text-slate-600">{op.total_pages?.toLocaleString() || '0'}</td>
                            <td className="py-4 text-right font-mono font-bold text-emerald-600">
                              {earnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-100">
                      <tr className="bg-slate-50/50 font-bold">
                        <td colSpan={2} className="py-4 text-slate-900 pl-4">GRAND TOTAL</td>
                        <td className="py-4 text-right font-mono text-slate-900">
                          {operatorsSummary.reduce((sum, op) => sum + (op.total_files || 0), 0).toLocaleString()}
                        </td>
                        <td className="py-4 text-right font-mono text-slate-900">
                          {operatorsSummary.reduce((sum, op) => sum + (op.total_pages || 0), 0).toLocaleString()}
                        </td>
                        <td className="py-4 text-right font-mono text-emerald-700">
                          {operatorsSummary.reduce((sum, op) => sum + ((op.total_pages || 0) * (op.rate || 0.3)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            </motion.div>
          ) : view === 'admin-management' && hasPermission('admin-management') ? (
            <motion.div 
              key="admin-management"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <Card className="border-emerald-100 bg-emerald-50/30">
                  <h4 className="font-bold mb-4 flex items-center gap-2 text-emerald-900">
                    <Users className="w-4 h-4" /> Add Operator to {sites.find(s => s.id === selectedSiteId)?.name}
                  </h4>
                  <div className="space-y-4">
                    <input 
                      type="text" 
                      placeholder="Operator Name"
                      value={newEmployeeName}
                      onChange={(e) => setNewEmployeeName(e.target.value)}
                      className="w-full bg-white border border-emerald-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <button 
                      onClick={handleAddEmployee}
                      className="w-full bg-emerald-600 text-white py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all"
                    >
                      Add Operator
                    </button>
                    {addEmployeeMessage && (
                      <div className={cn(
                        "px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2",
                        addEmployeeMessage.type === 'success' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
                      )}>
                        {addEmployeeMessage.type === 'success' ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                        {addEmployeeMessage.text}
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="border-blue-100 bg-blue-50/30">
                  <h4 className="font-bold mb-4 flex items-center gap-2 text-blue-900">
                    <TrendingUp className="w-4 h-4" /> Site Settings
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-blue-600 uppercase">Target {stats?.overall.unit || 'Files'}</label>
                      <div className="space-y-2">
                        <input 
                          type="number" 
                          placeholder={stats?.overall.target_files?.toString() || '0'}
                          value={updateTargetValue}
                          onChange={(e) => setUpdateTargetValue(e.target.value)}
                          className="w-full bg-white border border-blue-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/20"
                        />
                        <button 
                          onClick={handleUpdateTarget}
                          className="w-full bg-blue-600 text-white py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all"
                        >
                          Update Target
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-blue-100/50">
                      <label className="text-[10px] font-bold text-blue-600 uppercase">Total Mouza Scanned</label>
                      <div className="space-y-2">
                        <input 
                          type="number" 
                          placeholder={(stats?.overall.total_mouza_scanned !== undefined ? stats.overall.total_mouza_scanned : 0).toString()}
                          value={updateMouzaValue}
                          onChange={(e) => setUpdateMouzaValue(e.target.value)}
                          className="w-full bg-white border border-blue-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/20"
                        />
                        <button 
                          onClick={handleUpdateMouza}
                          className="w-full bg-indigo-600 text-white py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all"
                        >
                          Update Mouza
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="border-indigo-100 bg-indigo-50/30">
                  <h4 className="font-bold mb-4 flex items-center gap-2 text-indigo-950">
                    <CalendarIcon className="w-4 h-4 text-indigo-600" /> Project Forecast
                  </h4>
                  {forecast && typeof forecast === 'object' ? (
                    <div className="space-y-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Estimated Completion</span>
                        <span className="text-xl font-bold text-indigo-900">{forecast.date}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-white rounded-xl border border-indigo-100">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase">Days Left</span>
                          <span className="text-lg font-bold text-indigo-600">{forecast.days}</span>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-indigo-100">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase">Avg. Rate</span>
                          <span className="text-lg font-bold text-indigo-600">{forecast.rate} <span className="text-xs font-normal">f/d</span></span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 italic">
                        * Based on scanning rate of the last 7 active days.
                      </p>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-400 text-sm italic">
                      {forecast || "Insufficient data for forecast"}
                    </div>
                  )}
                </Card>

                <Card className="lg:col-span-3 border-slate-200 bg-white">
                  <h4 className="font-bold mb-4 flex items-center gap-2 text-slate-900">
                    <Users className="w-4 h-4 text-indigo-600" /> Manage Operators
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {adminData.filter(op => op.is_active).map(operator => (
                      <div key={operator.employee_id} className="flex flex-col p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700">{operator.name}</span>
                          <div className="flex items-center gap-1">
                            {confirmDeleteEmployeeId === operator.employee_id ? (
                              <div className="flex gap-1">
                                <button 
                                  type="button"
                                  onClick={() => handleDeleteEmployee(operator.employee_id)}
                                  className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
                                  title="Confirm Deactivate"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => setConfirmDeleteEmployeeId(null)}
                                  className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-all"
                                  title="Cancel"
                                >
                                  <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <button 
                                  type="button"
                                  onClick={() => {
                                    setIsUpdatingRate(operator.employee_id);
                                    setNewRateValue((operator as any).rate_per_page?.toString() || '0.30');
                                  }}
                                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                  title="Set Rate"
                                >
                                  <TrendingUp className="w-4 h-4" />
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => setConfirmDeleteEmployeeId(operator.employee_id)}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  title="Remove Operator"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {isUpdatingRate === operator.employee_id && (
                          <div className="flex items-center gap-2 mt-2">
                            <input 
                              type="number" 
                              step="0.001"
                              value={newRateValue}
                              onChange={(e) => setNewRateValue(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                              placeholder="Rate per page"
                              autoFocus
                            />
                            <button 
                              onClick={() => updateOperatorRate(operator.employee_id, parseFloat(newRateValue) || 0)}
                              className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={() => setIsUpdatingRate(null)}
                              className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        
                        <div className="text-[10px] font-bold text-slate-400 uppercase">
                          Rate: Rs {((operator as any).rate_per_page !== undefined && (operator as any).rate_per_page !== null) 
                            ? Number((operator as any).rate_per_page).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) 
                            : '0.30'} / page
                        </div>
                      </div>
                    ))}
                    {adminData.filter(op => op.is_active).length === 0 && (
                      <div className="col-span-full text-center py-4 text-slate-400 text-sm">
                        No operators found for this site.
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </motion.div>
          ) : view === 'user-controls' ? (
            <motion.div 
              key="user-controls"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <UserControlsPage apiFetch={apiFetch} currentUser={currentUser} />
            </motion.div>
          ) : view === 'operator-summary' && hasPermission('operator-summary') ? (
            <motion.div 
              key="operator-summary"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                    {currentUser?.employee_name 
                      ? `${currentUser.employee_name} Summary`
                      : `${allOperators.find(op => op.id === selectedOperatorId)?.name || 'Operator'} Summary`}
                  </h2>
                  <p className="text-slate-500 font-medium">View detailed performance per operator</p>
                </div>
                {!(currentUser?.role !== 'admin' && allOperators.length === 1) && (
                  <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                    <Users className="w-4 h-4 text-indigo-600 ml-2" />
                    <select 
                      value={selectedOperatorId || ''}
                      onChange={(e) => setSelectedOperatorId(e.target.value)}
                      className="bg-transparent text-sm font-bold text-slate-700 outline-none pr-4"
                    >
                      {allOperators
                        .filter((op: any) => !selectedSiteId || String(op.site_id) === String(selectedSiteId))
                        .map(op => (
                          <option key={op.id} value={op.id}>{op.name} ({op.site_name})</option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Month Wise Summary */}
                <Card className="lg:col-span-1">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-indigo-600" />
                    Month Wise Summary
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-400 font-medium border-b border-black/5">
                          <th className="text-left pb-3">Month</th>
                          <th className="text-right pb-3">{stats?.overall.unit || 'Files'}</th>
                          <th className="text-right pb-3">Pages</th>
                          <th className="text-right pb-3 text-emerald-600">Rs</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5">
                        {operatorSummary.map((m) => (
                          <tr key={m.month} className="group hover:bg-slate-50 transition-colors">
                            <td className="py-4 font-medium text-slate-700">{format(parseISO(m.month + '-01'), 'MMMM yyyy')}</td>
                            <td className="py-4 text-right font-mono text-slate-600">{m.total_files?.toLocaleString()}</td>
                            <td className="py-4 text-right font-mono text-slate-600">{m.total_pages?.toLocaleString()}</td>
                            <td className="py-4 text-right font-mono font-bold text-emerald-600">{m.total_rs?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                        {operatorSummary.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-400 italic">No data found</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Daily Detailed View */}
                <Card className="lg:col-span-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-indigo-600" />
                      Daily Details
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Month:</span>
                      <input 
                        type="month" 
                        value={summaryMonth}
                        onChange={(e) => setSummaryMonth(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white z-10">
                        <tr className="text-slate-400 font-medium border-b border-black/5">
                          <th className="text-left py-3">Date</th>
                          <th className="text-right py-3">{stats?.overall.unit || 'Files'}</th>
                          <th className="text-right py-3">Pages</th>
                          <th className="text-right py-3 text-emerald-600">Rs</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5">
                        {operatorDaily.map((d) => (
                          <tr key={d.date} className="group hover:bg-slate-50 transition-colors">
                            <td className="py-4 font-medium text-slate-700">{format(parseISO(d.date), 'dd MMM yyyy')}</td>
                            <td className="py-4 text-right font-mono text-slate-600">{d.files?.toLocaleString()}</td>
                            <td className="py-4 text-right font-mono text-slate-600">{d.pages?.toLocaleString()}</td>
                            <td className="py-4 text-right font-mono font-bold text-emerald-600">{d.rs?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                        {operatorDaily.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-400 italic">No data found for this month</td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot className="sticky bottom-0 bg-slate-50 font-bold border-t-2 border-slate-200">
                        <tr>
                          <td className="py-4 pl-4">MONTH TOTAL</td>
                          <td className="py-4 text-right font-mono">
                            {operatorDaily.reduce((sum, d) => sum + (d.files || 0), 0).toLocaleString()}
                          </td>
                          <td className="py-4 text-right font-mono">
                            {operatorDaily.reduce((sum, d) => sum + (d.pages || 0), 0).toLocaleString()}
                          </td>
                          <td className="py-4 text-right font-mono text-emerald-700">
                            {operatorDaily.reduce((sum, d) => sum + (d.rs || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Card>
              </div>
            </motion.div>
          ) : view === 'apps' ? (
            <motion.div 
              key="apps"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <AppsPage apiFetch={apiFetch} currentUser={currentUser} />
            </motion.div>
          ) : (
            <div />
          )}
        </AnimatePresence>
    </main>

    {/* Mobile swipe page indicator */}
    {(() => {
      const views = getSwipeViews();
      const currentIndex = views.indexOf(view);
      if (views.length <= 1) return null;
      return (
        <div className="fixed bottom-4 left-0 right-0 flex justify-center gap-1.5 md:hidden z-40">
          {views.map((v, i) => (
            <button
              key={v}
              onClick={() => setView(v as any)}
              className={cn(
                "rounded-full transition-all",
                i === currentIndex 
                  ? "w-4 h-1.5 bg-indigo-600" 
                  : "w-1.5 h-1.5 bg-slate-300"
              )}
            />
          ))}
        </div>
      );
    })()}
  </div>
);
}