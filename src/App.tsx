import React, { useState, useEffect, useCallback } from 'react';
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
  ChevronDown
} from 'lucide-react';
import UserControlsPage from './components/UserControlsPage';
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
import { Site, Employee, ScanningData, Stats } from './types';
import { LoginPage } from './components/LoginPage';

// --- Components ---

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("bg-white rounded-2xl border border-black/5 shadow-sm p-6", className)}>
    {children}
  </div>
);

const StatCard = ({ title, value, icon: Icon, colorClass, loading }: { title: string; value: string | number; icon: any; colorClass: string; loading?: boolean }) => (
  <Card className="flex items-center gap-4">
    <div className={cn("p-3 rounded-xl", colorClass)}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</p>
      {loading ? (
        <div className="h-8 w-24 bg-slate-100 animate-pulse rounded-lg mt-1" />
      ) : (
        <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
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
    'operator-summary'
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
  const [extraPages, setExtraPages] = useState<number | string>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [exportMonth, setExportMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [operatorsMonth, setOperatorsMonth] = useState(format(new Date(), 'yyyy-MM'));

  // Company State
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Management State
  const [showManagement, setShowManagement] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteTarget, setNewSiteTarget] = useState('');
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [updateTargetValue, setUpdateTargetValue] = useState('');
  const [confirmDeleteSite, setConfirmDeleteSite] = useState<string | number | null>(null);
  const [confirmDeleteEmployeeId, setConfirmDeleteEmployeeId] = useState<string | number | null>(null);
  const [copiedDate, setCopiedDate] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
              return permissions.includes('operator-summary') ? 'operator-summary' : (permissions.length > 0 ? permissions[0] : 'main-view');
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

  const currentMode = view === 'main-view' ? 'main' : 'personal';

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

  const fetchAllOperators = async () => {
    try {
      const res = await apiFetch('/api/all-operators');
      if (res.ok) {
        const data = await res.json();
        setAllOperators(data);
        if (data.length > 0 && !selectedOperatorId) {
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

  const handleCopy = (date: Date, files: number, pages: number) => {
    const dateStr = format(date, 'dd MMM yyyy');
    const text = `${dateStr}\nTotal Files: ${files}\nTotal Pages: ${pages}`;
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
      if (data.length > 0 && !selectedSiteId) setSelectedSiteId(data[0].id);
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

  const fetchAdminData = async () => {
    if (!selectedSiteId) return;
    setAdminData([]);
    setExtraPages(0);
    try {
      const res = await apiFetch(`/api/scanning-data?siteId=${selectedSiteId}&date=${adminDate}`);
      const data = await res.json();
      setAdminData(data.data);
      setExtraPages(data.extra_pages);
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

  const saveAdminData = async () => {
    if (!selectedSiteId) return;
    setIsSaving(true);
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
            pages: item.pages || 0
          })),
          extra_pages: parseInt(extraPages.toString()) || 0
        })
      });
      
      if (res.ok) {
        fetchStats(view === 'admin' ? 'personal' : 'main');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const downloadReport = (mode: 'personal' | 'main' = 'personal') => {
    if (!selectedSiteId) return;
    const token = localStorage.getItem('authToken');
    window.location.href = `/api/export/${selectedSiteId}?month=${exportMonth}&mode=${mode}&token=${token || ''}`;
  };

  const handleAddSite = async () => {
    if (!newSiteName) return;
    try {
      const res = await apiFetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSiteName, target_files: parseInt(newSiteTarget) || 0 })
      });
      if (res.ok) {
        setNewSiteName('');
        setNewSiteTarget('');
        fetchSites();
        fetchSitesSummary();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddEmployee = async () => {
    if (!newEmployeeName || !selectedSiteId) return;
    try {
      await apiFetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newEmployeeName, site_id: selectedSiteId })
      });
      setNewEmployeeName('');
      await fetchAdminData();
      await fetchStats();
    } catch (err) {
      console.error(err);
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
      fetchSites();
      fetchSitesSummary();
      if (selectedSiteId === id) setSelectedSiteId(null);
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
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-indigo-600 rounded-full"></div>
        <p className="text-slate-500 font-medium">Loading ScanTrack Pro...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Sidebar / Nav */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-black/5 z-50 px-4 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight hidden lg:block">ScanTrack Pro</h1>
        </div>

        <div className="flex items-center gap-4">
          {currentUser?.role === 'admin' ? (
            <div className="relative">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
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
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl">
              <User className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-bold text-slate-700">{currentUser?.username}</span>
            </div>
          )}

          <div className="flex items-center gap-2 sm:gap-4 ml-auto sm:ml-4 sm:pl-4 sm:border-l border-slate-200">
            {currentUser?.role === 'admin' && (
              <div className="flex items-center gap-2">
                {/* Site Logo Badge */}
                <div className="flex items-center gap-2 bg-slate-50 border border-black/5 rounded-xl px-2 py-1.5 sm:px-3">
                  <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shadow-sm shadow-indigo-100 shrink-0">
                    {sites.find(s => s.id === selectedSiteId)?.name.substring(0, 2).toUpperCase() || 'ST'}
                  </div>
                  <div className="relative flex flex-col">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-0.5">Active Site</span>
                    <select 
                      value={selectedSiteId || ''} 
                      onChange={(e) => setSelectedSiteId(Number(e.target.value))}
                      className="appearance-none bg-transparent text-[11px] sm:text-xs font-bold text-slate-700 focus:outline-none cursor-pointer pr-4"
                    >
                      {sites.map(site => (
                        <option key={site.id} value={site.id}>{site.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-0 bottom-0.5 pointer-events-none text-slate-400">
                      <ChevronRight className="w-2.5 h-2.5 rotate-90" />
                    </div>
                  </div>
                </div>
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

      <main className="pb-12 px-4 md:px-8 max-w-7xl mx-auto pt-24">
        <AnimatePresence mode="wait">
          {view === 'main-view' && hasPermission('main-view') && currentUser?.role === 'admin' ? (
            <motion.div 
              key="main-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h2>
                  <p className="text-slate-500 font-medium">Welcome back, {currentUser?.username || 'Admin'}</p>
                </div>
              </div>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                  title="Scanned Files" 
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
                  title="Target Files" 
                  value={stats?.overall.target_files?.toLocaleString() || '0'} 
                  icon={TrendingUp} 
                  colorClass="bg-emerald-500"
                  loading={!stats || stats.mode !== 'main'}
                />
                <StatCard 
                  title="Remaining" 
                  value={Math.max(0, (stats?.overall.target_files || 0) - (stats?.overall.total_files || 0)).toLocaleString()} 
                  icon={Plus} 
                  colorClass="bg-orange-500"
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
                          <th className="text-right pb-3">Files</th>
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
                          <th className="text-right pb-3">Files</th>
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
                            <tr key={i} className={cn(
                              "group transition-colors",
                              isSunday ? "bg-orange-50/50" : "hover:bg-slate-50"
                            )}>
                              <td className="py-4 font-medium text-slate-700">
                                {format(day, 'EEE, MMM d')}
                              </td>
                              {isSunday ? (
                                <td colSpan={3} className="py-4 text-center text-orange-600 font-bold uppercase tracking-widest text-xs">
                                  Sunday - Rest Day
                                </td>
                              ) : (
                                <>
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
                                </>
                              )}
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
                <Card className="lg:col-span-2">
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

                <div className="space-y-8">
                  <Card className="border-indigo-100 bg-indigo-50/20">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-900">
                      <CalendarIcon className="w-5 h-5" />
                      Project Forecast
                    </h3>
                    {forecast && typeof forecast === 'object' ? (
                      <div className="space-y-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-indigo-600 uppercase tracking-wider">Estimated Completion</span>
                          <span className="text-xl font-bold text-indigo-900">{forecast.date}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-white rounded-xl border border-indigo-100">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase">Days Left</span>
                            <span className="text-lg font-bold text-indigo-600">{forecast.days}</span>
                          </div>
                          <div className="p-3 bg-white rounded-xl border border-indigo-100">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase">Avg. Rate</span>
                            <span className="text-lg font-bold text-indigo-600">{forecast.rate} <span className="text-xs font-normal">f/d</span></span>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500 italic">
                          * Based on scanning rate of the last 7 active days.
                        </p>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-slate-400 text-sm italic">
                        {forecast || "Insufficient data for forecast"}
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            </motion.div>
          ) : view === 'personal-records' && hasPermission('personal-records') && currentUser?.role === 'admin' ? (
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
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Files Scanned</span>
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    Daily Data Entry (Personal)
                  </h3>
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
                    <div className="relative h-[42px]">
                      <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="number" 
                        value={extraPages}
                        onChange={(e) => setExtraPages(e.target.value)}
                        placeholder="Extra Pages"
                        className="bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 h-full w-32 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <button 
                      onClick={saveAdminData}
                      disabled={isSaving}
                      className="bg-indigo-600 text-white px-6 h-[42px] rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20"
                    >
                      {isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Data</>}
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 font-medium border-b border-black/5">
                        <th className="text-left pb-3">Operator Name</th>
                        <th className="text-right pb-3">Scanned Files</th>
                        <th className="text-right pb-3">Scanned Pages</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {adminData.map((item) => (
                        <tr key={item.employee_id} className={cn("group hover:bg-slate-50 transition-colors", item.is_active === 0 && "opacity-60 bg-slate-50/30")}>
                          <td className="py-4 font-medium text-slate-700">
                            {item.name}
                            {item.is_active === 0 && (
                              <span className="ml-2 text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-1.5 py-0.5 rounded">Inactive</span>
                            )}
                          </td>
                          <td className="py-4 text-right">
                            <input 
                              type="number" 
                              value={item.files === null ? '' : item.files}
                              onChange={(e) => handleAdminChange(item.employee_id, 'files', e.target.value)}
                              placeholder="0"
                              className="w-24 bg-slate-100 border-none rounded-lg px-3 py-1.5 text-right text-sm font-mono focus:ring-2 focus:ring-indigo-500/20"
                            />
                          </td>
                          <td className="py-4 text-right">
                            <input 
                              type="number" 
                              value={item.pages === null ? '' : item.pages}
                              onChange={(e) => handleAdminChange(item.employee_id, 'pages', e.target.value)}
                              placeholder="0"
                              className="w-24 bg-slate-100 border-none rounded-lg px-3 py-1.5 text-right text-sm font-mono focus:ring-2 focus:ring-indigo-500/20"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50/50 font-bold">
                        <td className="py-4 px-2">Daily Totals</td>
                        <td className="py-4 text-right font-mono text-indigo-600">
                          {adminData.reduce((sum, item) => sum + (item.files || 0), 0).toLocaleString()}
                        </td>
                        <td className="py-4 text-right font-mono text-indigo-600">
                          {adminData.reduce((sum, item) => sum + (item.pages || 0), 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
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
                      <h4 className="font-bold text-slate-900 mb-4 uppercase text-xs tracking-wider">Export Settings</h4>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm font-medium text-slate-600">Select Month:</span>
                          <input 
                            type="month" 
                            value={exportMonth}
                            onChange={(e) => setExportMonth(e.target.value)}
                            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20"
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
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button 
                        onClick={() => downloadReport('personal')}
                        className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all group"
                      >
                        <FileText className="w-8 h-8 text-slate-400 mb-2 group-hover:text-indigo-600 transition-colors" />
                        <span className="text-sm font-bold text-slate-700">Personal Sheet</span>
                        <span className="text-[10px] text-slate-400 uppercase mt-1">Excel Format</span>
                      </button>
                      <button 
                        onClick={() => downloadReport('main')}
                        className="flex flex-col items-center justify-center p-6 bg-indigo-600 rounded-2xl hover:bg-indigo-700 transition-all group shadow-lg shadow-indigo-500/20"
                      >
                        <Download className="w-8 h-8 text-white/80 mb-2 group-hover:text-white transition-colors" />
                        <span className="text-sm font-bold text-white">Main Sheet</span>
                        <span className="text-[10px] text-white/60 uppercase mt-1">Excel Format</span>
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
                      placeholder="Target Files"
                      value={newSiteTarget}
                      onChange={(e) => setNewSiteTarget(e.target.value)}
                      className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20"
                    />
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
                          <th className="text-right pb-3">Total Files</th>
                          <th className="text-right pb-3">Total Pages</th>
                          <th className="text-right pb-3 text-orange-600">EP</th>
                          <th className="text-right pb-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5">
                        {sitesSummary.map((site) => (
                          <tr key={site.id} className="group hover:bg-slate-50 transition-colors">
                            <td className="py-4 font-medium text-slate-700">{site.name}</td>
                            <td className="py-4 text-right font-mono text-slate-600">{site.total_files?.toLocaleString() || '0'}</td>
                            <td className="py-4 text-right font-mono text-slate-600">{site.total_pages?.toLocaleString() || '0'}</td>
                            <td className="py-4 text-right font-mono text-orange-600">{site.extra_pages?.toLocaleString() || '0'}</td>
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
                          <td className="py-4 text-right font-mono text-slate-900">
                            {sitesSummary.reduce((sum, s) => sum + (s.total_files || 0), 0).toLocaleString()}
                          </td>
                          <td className="py-4 text-right font-mono text-slate-900">
                            {sitesSummary.reduce((sum, s) => sum + (s.total_pages || 0), 0).toLocaleString()}
                          </td>
                          <td className="py-4 text-right font-mono text-orange-700">
                            {sitesSummary.reduce((sum, s) => sum + (s.extra_pages || 0), 0).toLocaleString()}
                          </td>
                          <td className="py-4"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Card>
              </div>
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
                        <th className="text-right pb-3">Total Files</th>
                        <th className="text-right pb-3">Total Pages</th>
                        <th className="text-right pb-3 text-emerald-600">Earnings (Rs)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {operatorsSummary.map((op) => {
                        const earnings = (op.total_pages || 0) * 0.3;
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
                          {operatorsSummary.reduce((sum, op) => sum + ((op.total_pages || 0) * 0.3), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  </div>
                </Card>

                <Card className="border-blue-100 bg-blue-50/30">
                  <h4 className="font-bold mb-4 flex items-center gap-2 text-blue-900">
                    <TrendingUp className="w-4 h-4" /> Site Settings
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-blue-600 uppercase">Target Files</label>
                      <div className="space-y-2">
                        <input 
                          type="number" 
                          placeholder={stats?.overall.target_files.toString()}
                          value={updateTargetValue}
                          onChange={(e) => setUpdateTargetValue(e.target.value)}
                          className="w-full bg-white border border-blue-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/20"
                        />
                        <button 
                          onClick={handleUpdateTarget}
                          className="w-full bg-blue-600 text-white py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all"
                        >
                          Update
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="lg:col-span-3 border-slate-200 bg-white">
                  <h4 className="font-bold mb-4 flex items-center gap-2 text-slate-900">
                    <Users className="w-4 h-4 text-indigo-600" /> Manage Operators
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {adminData.filter(op => op.is_active === 1).map(operator => (
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
                              step="0.01"
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
                          Rate: Rs {(operator as any).rate_per_page || 0.30} / page
                        </div>
                      </div>
                    ))}
                    {adminData.filter(op => op.is_active === 1).length === 0 && (
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
                    {allOperators.find(op => op.id === selectedOperatorId)?.name || 'Operator'} Summary
                  </h2>
                  <p className="text-slate-500 font-medium">View detailed performance per operator</p>
                </div>
                {!(currentUser?.role !== 'admin' && allOperators.length === 1) && (
                  <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
                    <Users className="w-4 h-4 text-indigo-600 ml-2" />
                    <select 
                      value={selectedOperatorId || ''}
                      onChange={(e) => setSelectedOperatorId(Number(e.target.value))}
                      className="bg-transparent text-sm font-bold text-slate-700 outline-none pr-4"
                    >
                      {allOperators.map(op => (
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
                          <th className="text-right pb-3">Files</th>
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
                          <th className="text-right py-3">Files</th>
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
          ) : (
            <div />
          )}
        </AnimatePresence>
    </main>
  </div>
);
}
