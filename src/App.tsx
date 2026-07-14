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
  FileSpreadsheet,
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
  RotateCcw,
  Sliders,
  Sparkles,
  ExternalLink
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

const StatCard = ({ title, value, icon: Icon, colorClass, loading, href }: { title: string; value: string | number; icon: any; colorClass: string; loading?: boolean; href?: string }) => {
  const cardContent = (
    <Card className={cn(
      "flex items-center gap-2 md:gap-4 p-3 md:p-6 transition-all duration-300", 
      href ? "hover:bg-slate-50 hover:border-emerald-200 hover:shadow-md cursor-pointer group" : ""
    )}>
      <div className={cn(
        "p-2 md:p-3 rounded-xl shrink-0 transition-transform duration-300", 
        colorClass,
        href ? "group-hover:scale-105" : ""
      )}>
        <Icon className="w-4 h-4 md:w-6 md:h-6 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] md:text-sm font-medium text-slate-500 uppercase tracking-wider truncate flex items-center gap-1">
          {title}
          {href && <Globe className="w-3.5 h-3.5 text-emerald-500 animate-pulse inline shrink-0" />}
        </p>
        {loading ? (
          <div className="h-6 md:h-8 w-16 md:w-24 bg-slate-100 animate-pulse rounded-lg mt-1" />
        ) : (
          <h3 className="text-lg md:text-2xl font-bold text-slate-900 flex items-center gap-2">
            {value}
            {href && (
              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 uppercase tracking-wider group-hover:bg-emerald-100 group-hover:text-emerald-800 transition-colors">
                Visit Link
              </span>
            )}
          </h3>
        )}
      </div>
    </Card>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block focus:outline-none">
        {cardContent}
      </a>
    );
  }

  return cardContent;
};

// --- Main App ---

export default function App() {
  const [view, setView] = useState<
    'main-view' | 
    'personal-records' | 
    'admin-data-entry' | 
    'admin-panel' |
    'admin-management' |
    'apps'
  >('main-view');
  const [adminActiveTab, setAdminActiveTab] = useState<'downloads' | 'sites' | 'users' | 'operators' | 'settings' | 'records'>('downloads');
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
  const [isDownloading, setIsDownloading] = useState<'personal' | 'main' | 'salary' | null>(null);
  const [addEmployeeMessage, setAddEmployeeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [exportMonth, setExportMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [exportType, setExportType] = useState<'month' | 'range'>('month');
  const [exportStartDate, setExportStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [exportEndDate, setExportEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [operatorsMonth, setOperatorsMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [operatorsFilterType, setOperatorsFilterType] = useState<'month' | 'range'>('month');
  const [operatorsStartDate, setOperatorsStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [operatorsEndDate, setOperatorsEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Company State
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Management State
  const [showManagement, setShowManagement] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteTarget, setNewSiteTarget] = useState('');
  const [newSiteRate, setNewSiteRate] = useState('0.3');
  const [newSiteUnit, setNewSiteUnit] = useState('Files');
  const [newSiteDefaultExtraPages, setNewSiteDefaultExtraPages] = useState('0');
  const [newSiteLink, setNewSiteLink] = useState('');
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [updateTargetValue, setUpdateTargetValue] = useState('');
  const [updateMouzaValue, setUpdateMouzaValue] = useState('');
  const [updateLinkValue, setUpdateLinkValue] = useState('');
  const [confirmDeleteSite, setConfirmDeleteSite] = useState<string | number | null>(null);
  const [confirmDeleteEmployeeId, setConfirmDeleteEmployeeId] = useState<string | number | null>(null);
  const [copiedDate, setCopiedDate] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSiteOpen, setIsSiteOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [isUpdatingRate, setIsUpdatingRate] = useState<string | number | null>(null);
  const [newRateValue, setNewRateValue] = useState('');
  const [isEditingOperatorName, setIsEditingOperatorName] = useState<string | number | null>(null);
  const [editingOperatorNameValue, setEditingOperatorNameValue] = useState<string>('');
  const [isUpdatingSiteRate, setIsUpdatingSiteRate] = useState<string | number | null>(null);
  const [newSiteRateValue, setNewSiteRateValue] = useState('');
  const [isUpdatingSiteUnit, setIsUpdatingSiteUnit] = useState<string | number | null>(null);
  const [newSiteUnitValue, setNewSiteUnitValue] = useState('');
  const [isUpdatingSiteDefaultEP, setIsUpdatingSiteDefaultEP] = useState<string | number | null>(null);
  const [newSiteDefaultEPValue, setNewSiteDefaultEPValue] = useState('');
  const [isUpdatingSiteLink, setIsUpdatingSiteLink] = useState<string | number | null>(null);
  const [newSiteLinkValue, setNewSiteLinkValue] = useState('');
  const [newSiteMouzaEntryLink, setNewSiteMouzaEntryLink] = useState('');
  const [updateMouzaEntryLinkValue, setUpdateMouzaEntryLinkValue] = useState('');
  const [isUpdatingSiteMouzaEntryLink, setIsUpdatingSiteMouzaEntryLink] = useState<string | number | null>(null);
  const [newSiteMouzaEntryLinkValue, setNewSiteMouzaEntryLinkValue] = useState('');

  // Past Extra Pages Editor States
  const [editPastSiteId, setEditPastSiteId] = useState<string>('');
  const [editPastDate, setEditPastDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [editPastEPValue, setEditPastEPValue] = useState<string>('0');
  const [isSavingPastEP, setIsSavingPastEP] = useState<boolean>(false);
  const [isFetchingPastEP, setIsFetchingPastEP] = useState<boolean>(false);
  const [pastEPMessage, setPastEPMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);



  // Wizard Data Entry State
  const [selectedOperatorIndex, setSelectedOperatorIndex] = useState<number>(0);
  const [showCompletionMessage, setShowCompletionMessage] = useState<boolean>(false);
  
  // WhatsApp Report Parser States
  const [showParser, setShowParser] = useState<boolean>(false);
  const [parserText, setParserText] = useState<string>('');
  const [parserFeedback, setParserFeedback] = useState<Array<{ type: 'success' | 'warning' | 'info'; message: string }>>([]);

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

  const currentMode = (view === 'personal-records' || (view === 'admin-panel' && adminActiveTab === 'records')) ? 'personal' : 'main';

  useEffect(() => {
    if (selectedSiteId) {
      setStats(null);
      fetchStats(currentMode);
    }
  }, [selectedSiteId, currentMode]);

  useEffect(() => {
    if (selectedSiteId && (view.startsWith('admin') || view === 'admin-panel')) {
      fetchAdminData();
    }
  }, [selectedSiteId, view, adminDate]);



  useEffect(() => {
    setSelectedOperatorIndex(0);
    setShowCompletionMessage(false);
  }, [adminDate, selectedSiteId, view]);

  useEffect(() => {
    if (view === 'admin-panel' || view === 'admin-management') {
      fetchSitesSummary();
      fetchOperatorsSummary();
    }
  }, [view, selectedSiteId, operatorsMonth, operatorsFilterType, operatorsStartDate, operatorsEndDate]);

  useEffect(() => {
    if ((view === 'admin-panel' || view === 'admin-management') && editPastSiteId && editPastDate) {
      fetchSpecificDateEP(editPastSiteId, editPastDate);
    }
  }, [editPastSiteId, editPastDate, view]);

  useEffect(() => {
    if ((view === 'admin-panel' || view === 'admin-management') && !editPastSiteId && sitesSummary.length > 0) {
      setEditPastSiteId(sitesSummary[0].id.toString());
    }
  }, [view, sitesSummary, editPastSiteId]);

  // Select first available admin active tab if current tab is not permitted
  useEffect(() => {
    if (view === 'admin-panel') {
      const permittedTabs: ('downloads' | 'sites' | 'users' | 'operators' | 'records')[] = [];
      if (hasPermission('admin-reports')) permittedTabs.push('downloads');
      if (hasPermission('admin-sites')) permittedTabs.push('sites');
      if (hasPermission('admin-operators')) permittedTabs.push('operators');
      if (currentUser?.role === 'admin') permittedTabs.push('users');
      if (hasPermission('personal-records')) permittedTabs.push('records');

      if (permittedTabs.length > 0 && !permittedTabs.includes(adminActiveTab as any)) {
        setAdminActiveTab(permittedTabs[0] as any);
      }
    }
  }, [view, adminActiveTab, currentUser]);

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

  const updateOperatorName = async (id: string | number, name: string) => {
    if (!name || name.trim().length < 2) return;
    try {
      const res = await apiFetch(`/api/employees/${id}/name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
      });
      if (res.ok) {
        setIsEditingOperatorName(null);
        setEditingOperatorNameValue('');
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

  const updateSiteLink = async (id: string | number, link: string) => {
    try {
      const res = await apiFetch(`/api/sites/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link })
      });
      if (res.ok) {
        setIsUpdatingSiteLink(null);
        setNewSiteLinkValue('');
        fetchSites();
        fetchSitesSummary();
        fetchStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateSiteMouzaEntryLink = async (id: string | number, mouzaEntryLink: string) => {
    try {
      const res = await apiFetch(`/api/sites/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mouza_entry_link: mouzaEntryLink })
      });
      if (res.ok) {
        setIsUpdatingSiteMouzaEntryLink(null);
        setNewSiteMouzaEntryLinkValue('');
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
      if (operatorsFilterType === 'month') {
        if (operatorsMonth) {
          url += (url.includes('?') ? '&' : '?') + `month=${operatorsMonth}`;
        }
      } else {
        if (operatorsStartDate) {
          url += (url.includes('?') ? '&' : '?') + `startDate=${operatorsStartDate}`;
        }
        if (operatorsEndDate) {
          url += (url.includes('?') ? '&' : '?') + `endDate=${operatorsEndDate}`;
        }
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

  const downloadSalarySheet = async () => {
    if (!selectedSiteId) return;
    setIsDownloading('salary');
    const token = localStorage.getItem('authToken');
    
    let url = `/api/export-salary/${selectedSiteId}?token=${token || ''}`;
    let filename = `Salary_Sheet.xls`;
    if (exportType === 'month') {
      url += `&month=${exportMonth}`;
    } else {
      url += `&startDate=${exportStartDate}&endDate=${exportEndDate}`;
    }

    try {
      const res = await fetch(url);
      if (res.ok) {
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        // Extract content disposition filename if available, else default
        const contentDisp = res.headers.get('content-disposition');
        if (contentDisp) {
          const match = contentDisp.match(/filename="?([^"]+)"?/);
          if (match && match[1]) {
            filename = match[1];
          }
        }
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

  const handlePrevDate = () => {
    try {
      const d = parseISO(adminDate);
      const newDate = addDays(d, -1);
      setAdminDate(format(newDate, 'yyyy-MM-dd'));
    } catch (err) {
      console.error(err);
    }
  };

  const handleNextDate = () => {
    try {
      const d = parseISO(adminDate);
      const newDate = addDays(d, 1);
      setAdminDate(format(newDate, 'yyyy-MM-dd'));
    } catch (err) {
      console.error(err);
    }
  };

  const getLevenshteinDistance = (a: string, b: string): number => {
    const tmp: number[][] = [];
    for (let i = 0; i <= a.length; i++) {
      tmp[i] = [i];
    }
    for (let j = 0; j <= b.length; j++) {
      tmp[0][j] = j;
    }
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        tmp[i][j] = Math.min(
          tmp[i - 1][j] + 1, // deletion
          tmp[i][j - 1] + 1, // insertion
          tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1) // substitution
        );
      }
    }
    return tmp[a.length][b.length];
  };

  const getStringSimilarity = (s1: string, s2: string): number => {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    const longerLength = longer.length;
    if (longerLength === 0) {
      return 1.0;
    }
    return (longerLength - getLevenshteinDistance(longer, shorter)) / longerLength;
  };

  const isParserMetadataLine = (l: string): boolean => {
    const cleanLine = l.toLowerCase();
    return (
      cleanLine.includes('page') || 
      cleanLine.includes('pagis') || 
      cleanLine.includes('pege') || 
      cleanLine.includes('paje') || 
      cleanLine.includes('pge') ||
      cleanLine.includes('paige') ||
      cleanLine.includes('register') || 
      cleanLine.includes('rigester') || 
      cleanLine.includes('ragister') || 
      cleanLine.includes('ragistar') || 
      cleanLine.includes('regester') || 
      cleanLine.includes('registar') || 
      cleanLine.includes('rigister') ||
      cleanLine.includes('ragistre') ||
      cleanLine.includes('registre') ||
      cleanLine.includes('volume') || 
      cleanLine.includes('vol') ||
      cleanLine.includes('file') || 
      cleanLine.includes('mouza') || 
      cleanLine.includes('mauza') || 
      cleanLine.includes('moza') || 
      cleanLine.includes('date') || 
      /^\d+/.test(cleanLine)
    );
  };

  const parseTabularLine = (line: string): { name: string; files: number | null; pages: number | null } | null => {
    const parts = line.split(/\t+|\s{2,}/).map(p => p.trim()).filter(Boolean);
    if (parts.length < 3) return null;

    const isDateOrTime = (str: string) => {
      const clean = str.toLowerCase();
      if (/^\d{1,4}[/\-]\d{1,4}[/\-]\d{2,4}$/.test(clean)) return true;
      if (/^\d{1,2}:\d{2}(:\d{2})?(\s*(am|pm))?$/i.test(clean)) return true;
      if (/^\d{1,4}[/\-]\d{1,4}[/\-]\d{2,4}\s+\d{1,2}:\d{2}(:\d{2})?(\s*(am|pm))?$/i.test(clean)) return true;
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      if (days.some(d => clean === d || clean.startsWith(d + ',')) || months.some(m => clean === m || clean.startsWith(m + ' '))) return true;
      return false;
    };

    const isNumeric = (str: string) => {
      return /^\d[\d,]*$/.test(str);
    };

    const filteredParts = parts.filter(p => !isDateOrTime(p));
    if (filteredParts.length < 2) return null;

    const numericCandidates: number[] = [];
    const nameCandidates: string[] = [];

    filteredParts.forEach(part => {
      if (isNumeric(part)) {
        const val = parseInt(part.replace(/,/g, ''), 10);
        if (!isNaN(val)) {
          numericCandidates.push(val);
        }
      } else {
        if (/[a-zA-Z\u0600-\u06FF]/.test(part)) {
          nameCandidates.push(part);
        }
      }
    });

    if (nameCandidates.length > 0 && numericCandidates.length > 0) {
      const name = nameCandidates[0];
      let files: number | null = null;
      let pages: number | null = null;

      if (numericCandidates.length >= 2) {
        files = numericCandidates[0];
        pages = numericCandidates[1];
      } else if (numericCandidates.length === 1) {
        pages = numericCandidates[0];
      }

      return { name, files, pages };
    }

    return null;
  };

  const getMatchScore = (operatorName: string, blockText: string): number => {
    const cleanText = blockText.toLowerCase();
    const cleanOp = operatorName.toLowerCase();
    
    // 1. Perfect exact match of full name
    if (cleanText.includes(cleanOp)) {
      return 100;
    }
    
    // 2. Reversed name check (for names like "Younis Malik" vs "Malik Younis")
    const opParts = cleanOp.split(/\s+/).filter(p => p.length > 0);
    const reversedOp = [...opParts].reverse().join(' ');
    if (cleanText.includes(reversedOp)) {
      return 95;
    }
    
    // 3. Fuzzy matching on lines
    const lines = blockText.split('\n').map(l => l.trim().toLowerCase()).filter(Boolean);
    let maxFuzzyScore = 0;
    
    for (const line of lines) {
      // Clean leading/trailing symbols or common message characters if any
      const cleanedLine = line.replace(/^[•\-*\s]+|[•\-*\s]+$/g, '').trim();
      if (!cleanedLine) continue;

      // Avoid matching lines that are obviously metadata
      if (
        isParserMetadataLine(cleanedLine) ||
        cleanedLine.startsWith('[') || 
        cleanedLine.includes('pm') || 
        cleanedLine.includes('am')
      ) {
        continue;
      }
      
      // Calculate similarity to full name
      const simDirect = getStringSimilarity(cleanOp, cleanedLine);
      // Calculate similarity to reversed name
      const simReversed = getStringSimilarity(reversedOp, cleanedLine);
      
      const bestSim = Math.max(simDirect, simReversed);
      
      // Support matching individual parts of the name (e.g. "Saboor" matching "Abdul Saboor" line)
      let bestPartSim = 0;
      if (opParts.length > 1) {
        const lineWords = cleanedLine.split(/\s+/).filter(w => w.length > 0);
        for (const opPart of opParts) {
          if (opPart.length > 2) {
            for (const lineWord of lineWords) {
              if (lineWord.length > 2) {
                const partSim = getStringSimilarity(opPart, lineWord);
                if (partSim > bestPartSim) {
                  bestPartSim = partSim;
                }
              }
            }
          }
        }
      }
      
      // Convert similarity to a 0-100 scale
      // Give a slight penalty to part-only matches to prefer full matches
      const score = Math.max(bestSim * 100, bestPartSim * 80);
      if (score > maxFuzzyScore) {
        maxFuzzyScore = score;
      }
    }
    
    // 4. Token-based fallback match
    let matchedTokens = 0;
    let totalTokens = opParts.length;
    
    for (const part of opParts) {
      if (part.length <= 1) {
        if (cleanText.includes(' ' + part + ' ') || cleanText.startsWith(part + ' ') || cleanText.endsWith(' ' + part)) {
          matchedTokens++;
        }
      } else if (cleanText.includes(part)) {
        matchedTokens++;
      }
    }
    
    let tokenScore = 0;
    if (matchedTokens > 0 && totalTokens > 0) {
      tokenScore = Math.round((matchedTokens / totalTokens) * 80);
    }
    
    return Math.max(maxFuzzyScore, tokenScore);
  };

  const handleAutoParse = () => {
    if (!parserText.trim()) {
      setParserFeedback([{ type: 'warning', message: 'Please paste some text first.' }]);
      return;
    }

    const lines = parserText.split(/\r?\n/);
    const blocks: Array<{ type: 'freeform' | 'tabular'; lines: string[]; tabularData?: { name: string; files: number | null; pages: number | null } }> = [];
    let currentBlock: string[] = [];

    // Check if line starts with a WhatsApp timestamp
    const isWhatsAppHeader = (l: string) => /^\[\d{1,2}:\d{2}\s*(?:AM|PM)?,?\s*\d{1,2}\/\d{1,2}\/\d{2,4}\]/i.test(l.trim());

    // Helper to identify if line contains an operator name exactly or partially
    const isOperatorNameLine = (l: string) => {
      const cleanLine = l.trim().toLowerCase();
      if (!cleanLine) return false;
      if (isParserMetadataLine(cleanLine)) {
        return false;
      }

      return adminData.some(op => {
        const opName = op.name.toLowerCase();
        if (cleanLine.includes(opName)) return true;
        const parts = opName.split(/\s+/).filter(p => p.length > 0);
        const reversed = [...parts].reverse().join(' ');
        if (cleanLine.includes(reversed)) return true;
        if (parts.length >= 2 && parts.every(p => cleanLine.includes(p))) {
          return true;
        }
        return false;
      });
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        if (currentBlock.length > 0) {
          blocks.push({ type: 'freeform', lines: currentBlock });
          currentBlock = [];
        }
        continue;
      }

      const tabularData = parseTabularLine(line);
      if (tabularData) {
        if (currentBlock.length > 0) {
          blocks.push({ type: 'freeform', lines: currentBlock });
          currentBlock = [];
        }
        blocks.push({ type: 'tabular', lines: [line], tabularData });
        continue;
      }

      const isHeader = isWhatsAppHeader(line);
      const isNewOp = isOperatorNameLine(line);

      if (isHeader || isNewOp) {
        if (currentBlock.length > 0) {
          blocks.push({ type: 'freeform', lines: currentBlock });
          currentBlock = [];
        }
      }

      currentBlock.push(line);
    }
    if (currentBlock.length > 0) {
      blocks.push({ type: 'freeform', lines: currentBlock });
    }

    const feedback: Array<{ type: 'success' | 'warning' | 'info'; message: string }> = [];
    let updatedCount = 0;
    
    // Create a copy of the current adminData to apply updates
    let newAdminData = [...adminData];

    blocks.forEach((block) => {
      if (block.type === 'tabular' && block.tabularData) {
        const { name, files, pages } = block.tabularData;
        
        // Match the operator
        let bestOperator: any = null;
        let bestScore = 0;

        adminData.forEach(op => {
          const score = getMatchScore(op.name, name);
          if (score > bestScore) {
            bestScore = score;
            bestOperator = op;
          }
        });

        if (bestOperator && bestScore >= 40) {
          // Update this operator in our copied data
          newAdminData = newAdminData.map(item => {
            if (item.employee_id === bestOperator.employee_id) {
              return {
                ...item,
                files: files !== null ? files : item.files,
                pages: pages !== null ? pages : item.pages
              };
            }
            return item;
          });

          updatedCount++;
          let fileLabel = (stats?.overall?.unit) || (sites.find(s => s.id === selectedSiteId) as any)?.unit || 'Files';
          feedback.push({
            type: 'success',
            message: `Matched "${bestOperator.name}" (${bestScore}% Confidence) from table row -> ${files !== null ? `${files} ${fileLabel}` : `no ${fileLabel}`}, ${pages !== null ? `${pages} Pages` : 'no Pages'}.`
          });
        } else {
          feedback.push({
            type: 'warning',
            message: `Could not match operator report starting with "${name.substring(0, 30)}..."`
          });
        }
      } else {
        const blockLines = block.lines;
        // 1. Clean WhatsApp timestamp and sender name from the block text
        const processedLines = blockLines.map((line, idx) => {
          let l = line.trim();
          const timestampRegex = /^\[\d{1,2}:\d{2}\s*(?:AM|PM)?,?\s*\d{1,2}\/\d{1,2}\/\d{2,4}\]\s*/i;
          if (idx === 0 && timestampRegex.test(l)) {
            l = l.replace(timestampRegex, '');
            const colonIndex = l.indexOf(':');
            if (colonIndex !== -1) {
              l = l.substring(colonIndex + 1).trim();
            }
          }
          return l;
        });

        const cleanedBlockText = processedLines.join('\n');
        
        // 2. Score operators to find the best match
        let bestOperator: any = null;
        let bestScore = 0;

        adminData.forEach(op => {
          const score = getMatchScore(op.name, cleanedBlockText);
          if (score > bestScore) {
            bestScore = score;
            bestOperator = op;
          }
        });

        // 3. Extract registers/files and pages supporting multiple spelling variations (e.g. ragistar, peges)
        const regRegex = /(?:register|rigester|ragistar|ragister|regester|registar|rigister|ragistre|registre|volume|vol|reg|file)s?\s*[:\-\s=_]*\s*(\d[\d,]*)/i;
        const pageRegex = /(?:page|pagis|pege|paje|pge|paige|pag)s?\s*[:\-\s=_]*\s*(\d[\d,]*)/i;

        const extractNum = (text: string, regex: RegExp): number | null => {
          const match = text.match(regex);
          if (match && match[1]) {
            const cleanNum = match[1].replace(/,/g, '');
            const parsed = parseInt(cleanNum, 10);
            return isNaN(parsed) ? null : parsed;
          }
          return null;
        };

        const extractedFiles = extractNum(cleanedBlockText, regRegex);
        const extractedPages = extractNum(cleanedBlockText, pageRegex);

        if (bestOperator && bestScore >= 40) {
          // Update this operator in our copied data
          newAdminData = newAdminData.map(item => {
            if (item.employee_id === bestOperator.employee_id) {
              return {
                ...item,
                files: extractedFiles !== null ? extractedFiles : item.files,
                pages: extractedPages !== null ? extractedPages : item.pages
              };
            }
            return item;
          });

          updatedCount++;
          
          let fileLabel = (stats?.overall?.unit) || (sites.find(s => s.id === selectedSiteId) as any)?.unit || 'Files';
          feedback.push({
            type: 'success',
            message: `Matched "${bestOperator.name}" (${bestScore}% Confidence) -> ${extractedFiles !== null ? `${extractedFiles} ${fileLabel}` : `no ${fileLabel}`}, ${extractedPages !== null ? `${extractedPages} Pages` : 'no Pages'}.`
          });
        } else {
          // Extract a candidate name from the first line for display
          const firstLine = processedLines[0] || 'Unknown';
          feedback.push({
            type: 'warning',
            message: `Could not match operator report starting with "${firstLine.substring(0, 30)}..."`
          });
        }
      }
    });

    if (updatedCount > 0) {
      setAdminData(newAdminData);
      feedback.unshift({
        type: 'info',
        message: `Successfully parsed and filled data for ${updatedCount} operator(s)! Please review the form below and click "Save All Progress" to save.`
      });
    } else {
      feedback.unshift({
        type: 'warning',
        message: 'Could not match any reports. Please check that operator names in your pasted text match active operator names.'
      });
    }

    setParserFeedback(feedback);
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
          default_extra_pages: parseInt(newSiteDefaultExtraPages) || 0,
          link: newSiteLink || '',
          mouza_entry_link: newSiteMouzaEntryLink || ''
        })
      });
      if (res.ok) {
        setNewSiteName('');
        setNewSiteTarget('');
        setNewSiteRate('0.3');
        setNewSiteUnit('Files');
        setNewSiteDefaultExtraPages('0');
        setNewSiteLink('');
        setNewSiteMouzaEntryLink('');
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

  const handleUpdateLink = async () => {
    if (!selectedSiteId || !updateLinkValue) return;
    try {
      await apiFetch(`/api/sites/${selectedSiteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: updateLinkValue })
      });
      setUpdateLinkValue('');
      fetchStats();
      fetchSites();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateMouzaEntryLink = async () => {
    if (!selectedSiteId || !updateMouzaEntryLinkValue) return;
    try {
      await apiFetch(`/api/sites/${selectedSiteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mouza_entry_link: updateMouzaEntryLinkValue })
      });
      setUpdateMouzaEntryLinkValue('');
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
      return ['main-view', 'personal-records', 'admin-data-entry', 'admin-panel', 'admin-management', 'apps'];
    }
    const permOrder = ['main-view', 'personal-records', 'admin-data-entry', 'admin-panel', 'admin-management', 'apps'];
    return permOrder.filter(p => p === 'admin-panel' ? (
      hasPermission('admin-reports') || hasPermission('admin-sites') || hasPermission('admin-operators')
    ) : hasPermission(p) || p === 'apps');
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
            {(hasPermission('admin-reports') || hasPermission('admin-sites') || hasPermission('admin-operators') || currentUser?.role === 'admin') && (
              <button 
                onClick={() => setView('admin-panel')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                  view === 'admin-panel' ? "bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100/50" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Sliders className="w-3.5 h-3.5" />
                Admin Panel
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
                Site Configurations
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
                                onClick={() => { 
                                  setView('personal-records'); 
                                  setIsMenuOpen(false); 
                                }}
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

                        { (hasPermission('admin-data-entry') || hasPermission('admin-reports') || hasPermission('admin-sites') || hasPermission('admin-operators') || hasPermission('admin-management') || currentUser?.role === 'admin') && (
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
                            {(hasPermission('admin-reports') || hasPermission('admin-sites') || hasPermission('admin-operators') || currentUser?.role === 'admin') && (
                              <button 
                                onClick={() => { setView('admin-panel'); setIsMenuOpen(false); }}
                                className={cn(
                                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all",
                                  view === 'admin-panel' ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50"
                                )}
                              >
                                <Sliders className="w-4 h-4" />
                                Admin Panel
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
                                Site Configurations
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


                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="flex items-center gap-2 sm:gap-4 ml-auto sm:ml-4 sm:pl-4 sm:border-l border-slate-200">
            {/* If active site has a link set, show a visit link button */}
            {sites.find(s => s.id === selectedSiteId)?.link && (
              <a
                href={sites.find(s => s.id === selectedSiteId)?.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all shadow-sm"
                title="Mouza Details"
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Mouza Details</span>
              </a>
            )}

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
                  href={sites.find(s => s.id === selectedSiteId)?.link || undefined}
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
                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-1 h-[42px]">
                      <button 
                        type="button"
                        onClick={handlePrevDate}
                        className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                        title="Previous Day"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <div className="relative h-full flex items-center px-2">
                        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input 
                          type="date" 
                          value={adminDate}
                          onChange={(e) => setAdminDate(e.target.value)}
                          className="bg-transparent border-none pl-8 pr-1 py-1 h-full text-sm font-semibold text-slate-800 focus:outline-none w-[130px]"
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={handleNextDate}
                        className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                        title="Next Day"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Totals displaying next to the date */}
                    <div className="flex items-center gap-3 px-3 py-1 bg-indigo-50/60 border border-indigo-100 rounded-xl h-[42px]">
                      <div className="text-left leading-none">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Today's Entry</span>
                        <div className="flex items-center gap-4 mt-0.5">
                          <span className="text-xs font-bold text-slate-700">
                            Pages: <span className="text-indigo-600">{adminData.reduce((sum, item) => sum + (item.pages || 0), 0).toLocaleString()}</span>
                          </span>
                          <span className="text-xs font-bold text-slate-700">
                            {(stats?.overall?.unit) || (sites.find(s => s.id === selectedSiteId) as any)?.unit || 'Files'}: <span className="text-indigo-600">{adminData.reduce((sum, item) => sum + (item.files || 0), 0).toLocaleString()}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => saveAdminData()}
                      disabled={isSaving}
                      className="bg-indigo-600 text-white px-6 h-[42px] rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20 cursor-pointer"
                    >
                      {isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Save All Progress</>}
                    </button>
                    {sites.find(s => s.id === selectedSiteId)?.mouza_entry_link && (
                      <a 
                        href={sites.find(s => s.id === selectedSiteId)?.mouza_entry_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 h-[42px] rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-550/20 font-inherit"
                      >
                        <Globe className="w-4 h-4" /> Mouza Entry
                      </a>
                    )}

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

                {/* WhatsApp Report Auto-Parser */}
                <div className="mb-6 bg-slate-50 border border-slate-200/60 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      onClick={() => setShowParser(!showParser)}
                      className="flex items-center gap-2 text-sm font-bold text-slate-800 hover:text-indigo-600 transition-colors cursor-pointer text-left focus:outline-none"
                    >
                      <Sparkles className="w-4.5 h-4.5 text-indigo-500 animate-pulse shrink-0" />
                      <span>{showParser ? "Hide WhatsApp Auto-Parser" : "✨ Paste WhatsApp Report (Auto Fill)"}</span>
                      <span className="text-[9px] bg-indigo-100 text-indigo-700 font-extrabold px-2 py-0.5 rounded-full uppercase shrink-0">
                        New
                      </span>
                    </button>
                    {showParser && parserText && (
                      <button
                        type="button"
                        onClick={() => {
                          setParserText('');
                          setParserFeedback([]);
                        }}
                        className="text-xs text-slate-500 hover:text-red-500 font-bold transition-colors cursor-pointer focus:outline-none"
                      >
                        Clear Text
                      </button>
                    )}
                  </div>

                  {showParser ? (
                    <div className="space-y-4">
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">
                        Paste the copied WhatsApp text from your operators in the text area below. The system will automatically detect the operators by matching their names, count their scanned registers (volumes/files) and pages, and fill the form below.
                      </p>
                      
                      <div className="relative">
                        <textarea
                          rows={6}
                          value={parserText}
                          onChange={(e) => setParserText(e.target.value)}
                          placeholder="Paste WhatsApp text here... e.g.&#10;Abdul Saboor&#10;04-07-2026&#10;Volume:6&#10;Pages 2078&#10;&#10;Qudsia&#10;Date: 04-07-2026&#10;Total Register: 19&#10;Total Pages: 7039"
                          className="w-full bg-white border border-slate-200 rounded-xl p-4 text-xs font-semibold font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-inner min-h-[140px]"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleAutoParse}
                          className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 cursor-pointer focus:outline-none"
                        >
                          <Sparkles className="w-4 h-4" />
                          Auto Parse & Fill Form
                        </button>
                      </div>

                      {parserFeedback.length > 0 && (
                        <div className="mt-4 bg-white border border-slate-200/50 rounded-xl p-4 max-h-[220px] overflow-y-auto space-y-2 shadow-inner">
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Parsing Results</h5>
                          <div className="space-y-1.5">
                            {parserFeedback.map((fb, i) => (
                              <div
                                key={i}
                                className={cn(
                                  "text-xs p-2.5 rounded-lg flex items-start gap-2 font-medium border leading-relaxed",
                                  fb.type === 'success' && "bg-emerald-50/60 text-emerald-800 border-emerald-100",
                                  fb.type === 'warning' && "bg-amber-50/60 text-amber-800 border-amber-100",
                                  fb.type === 'info' && "bg-indigo-50/60 text-indigo-800 border-indigo-100"
                                )}
                              >
                                <span className="mt-0.5 text-sm shrink-0">
                                  {fb.type === 'success' && "✅"}
                                  {fb.type === 'warning' && "⚠️"}
                                  {fb.type === 'info' && "💡"}
                                </span>
                                <span>{fb.message}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 font-medium">
                      Have a WhatsApp group chat with daily operator counts? Click to expand and paste the entire block to auto-fill the whole page in 1-second!
                    </p>
                  )}
                </div>

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
                        className="bg-indigo-600 text-white hover:bg-indigo-700 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-200"
                      >
                        Start From Operator 1
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
            </motion.div>

          ) : view === 'admin-panel' && (hasPermission('admin-reports') || hasPermission('admin-sites') || hasPermission('admin-operators') || hasPermission('admin-management') || hasPermission('personal-records') || currentUser?.role === 'admin') ? (
            <motion.div 
              key="admin-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-2 gap-4 border-b border-slate-100">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <Sliders className="w-8 h-8 text-indigo-600" />
                    Admin Control Panel
                  </h2>
                  <p className="text-slate-500 font-medium">Manage sites, downloads, operators, users and configuration parameters</p>
                </div>
              </div>

              {/* Seamless Tab Navigation */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/60 p-1.5 rounded-2xl border border-slate-200">
                {hasPermission('personal-records') && (
                  <button
                    type="button"
                    onClick={() => setAdminActiveTab('records')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
                      adminActiveTab === 'records' 
                        ? "bg-white text-indigo-600 shadow-sm border border-slate-200/40" 
                        : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-900"
                    )}
                  >
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    Personal Records
                  </button>
                )}
                {hasPermission('admin-reports') && (
                  <button
                    type="button"
                    onClick={() => setAdminActiveTab('downloads')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
                      adminActiveTab === 'downloads' 
                        ? "bg-white text-indigo-600 shadow-sm border border-slate-200/40" 
                        : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-900"
                    )}
                  >
                    <Download className="w-4 h-4 text-orange-600" />
                    Downloads
                  </button>
                )}
                {hasPermission('admin-sites') && (
                  <button
                    type="button"
                    onClick={() => setAdminActiveTab('sites')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
                      adminActiveTab === 'sites' 
                        ? "bg-white text-indigo-600 shadow-sm border border-slate-200/40" 
                        : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-900"
                    )}
                  >
                    <Layers className="w-4 h-4 text-indigo-600" />
                    Sites Management
                  </button>
                )}
                {hasPermission('admin-operators') && (
                  <button
                    type="button"
                    onClick={() => setAdminActiveTab('operators')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
                      adminActiveTab === 'operators' 
                        ? "bg-white text-indigo-600 shadow-sm border border-slate-200/40" 
                        : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-900"
                    )}
                  >
                    <Users className="w-4 h-4 text-emerald-600" />
                    Operators Summary
                  </button>
                )}
                {currentUser?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => setAdminActiveTab('users')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
                      adminActiveTab === 'users' 
                        ? "bg-white text-indigo-600 shadow-sm border border-slate-200/40" 
                        : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-900"
                    )}
                  >
                    <UserCog className="w-4 h-4 text-indigo-600" />
                    Users Control
                  </button>
                )}

              </div>

              {/* Render Selected Tab content */}
              <AnimatePresence mode="wait">
                {adminActiveTab === 'downloads' && hasPermission('admin-reports') && (
                  <motion.div
                    key="tab-downloads"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="space-y-6"
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
                                    className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-550/20 text-slate-700 outline-none"
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
                                    className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-550/20 text-slate-700 outline-none"
                                  />
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-sm font-medium text-slate-600">To Date:</span>
                                  <input 
                                    type="date" 
                                    value={exportEndDate}
                                    onChange={(e) => setExportEndDate(e.target.value)}
                                    className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-550/20 text-slate-700 outline-none"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <button 
                            type="button"
                            onClick={() => downloadReport('personal')}
                            disabled={isDownloading !== null}
                            className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all group disabled:opacity-60 font-inherit cursor-pointer"
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
                            type="button"
                            onClick={() => downloadReport('main')}
                            disabled={isDownloading !== null}
                            className="flex flex-col items-center justify-center p-6 bg-indigo-600 rounded-2xl hover:bg-indigo-700 transition-all group shadow-lg shadow-indigo-500/20 disabled:opacity-60 font-inherit cursor-pointer"
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
                            type="button"
                            onClick={downloadSalarySheet}
                            disabled={isDownloading !== null}
                            className="flex flex-col items-center justify-center p-6 bg-teal-600 rounded-2xl hover:bg-teal-700 text-white transition-all group shadow-lg shadow-teal-500/20 disabled:opacity-60 font-inherit cursor-pointer"
                          >
                            {isDownloading === 'salary' ? (
                              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mb-2" />
                            ) : (
                              <FileSpreadsheet className="w-8 h-8 text-white/80 mb-2 group-hover:text-white transition-colors" />
                            )}
                            <span className="text-sm font-bold">Salary Sheet</span>
                            <span className="text-[10px] text-teal-200 uppercase mt-1">Sallery Sheet (Urdu Format)</span>
                          </button>
                          <button 
                            type="button"
                            onClick={downloadPDFReport}
                            className="flex flex-col items-center justify-center p-6 bg-rose-600 rounded-2xl hover:bg-rose-700 text-white transition-all group shadow-lg shadow-rose-550/20 font-inherit cursor-pointer"
                          >
                            <Layers className="w-8 h-8 text-rose-200 mb-2 group-hover:text-white transition-colors" />
                            <span className="text-sm font-bold">PDF Summary</span>
                            <span className="text-[10px] text-rose-200 uppercase mt-1">Multan Scanning</span>
                          </button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )}

                {adminActiveTab === 'sites' && hasPermission('admin-sites') && (
                  <motion.div
                    key="tab-sites"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="space-y-6"
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
                              className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-505/20 font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-indigo-400 uppercase ml-1">Site Link (Optional URL)</label>
                            <input 
                              type="text" 
                              placeholder="e.g. https://site-link.com"
                              value={newSiteLink}
                              onChange={(e) => setNewSiteLink(e.target.value)}
                              className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-indigo-400 uppercase ml-1">Mouza Entry Link (Optional URL)</label>
                            <input 
                              type="text" 
                              placeholder="e.g. https://mouza-entry-link.com"
                              value={newSiteMouzaEntryLink}
                              onChange={(e) => setNewSiteMouzaEntryLink(e.target.value)}
                              className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20"
                            />
                          </div>
                          <button 
                            type="button"
                            onClick={handleAddSite}
                            className="w-full bg-indigo-600 text-white py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all font-inherit"
                          >
                            Create Site
                          </button>
                        </div>
                      </Card>

                      <Card className="lg:col-span-2 border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                          <h4 className="font-bold flex items-center gap-2 text-slate-900 text-sm md:text-base">
                            <LayoutDashboard className="w-5 h-5 text-indigo-600" /> Site Overview
                          </h4>
                          <span className="text-xs text-slate-400">Manage sites, custom units, rates, and reference documents</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="bg-slate-50/70 text-slate-500 font-semibold text-[10px] md:text-[11px] uppercase tracking-wider border-b border-slate-100">
                                <th className="text-left px-4 py-3.5 font-semibold text-slate-500">Site Name</th>
                                <th className="text-right px-4 py-3.5 font-semibold text-slate-500">Rate</th>
                                <th className="text-right px-4 py-3.5 font-semibold text-slate-500">Unit</th>
                                <th className="text-right px-4 py-3.5 font-semibold text-indigo-600 bg-indigo-50/30">Default EP</th>
                                <th className="text-center px-4 py-3.5 font-semibold text-emerald-600">Site Link</th>
                                <th className="text-center px-4 py-3.5 font-semibold text-teal-600">Mouza Entry Link</th>
                                <th className="text-right px-4 py-3.5 font-semibold text-orange-600 bg-orange-50/30">Total EP</th>
                                <th className="text-right px-4 py-3.5 font-semibold text-slate-500">Total Scanned</th>
                                <th className="text-right px-4 py-3.5 font-semibold text-slate-500">Total Pages</th>
                                <th className="text-center px-4 py-3.5 font-semibold text-slate-500">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {sitesSummary.map((site) => (
                                <tr key={site.id} className="group hover:bg-slate-50/50 transition-colors">
                                  <td className="px-4 py-3.5 text-left font-semibold text-slate-800 min-w-[140px]">{site.name}</td>
                                  
                                  {/* Rate cell */}
                                  <td className="px-4 py-3.5 text-right font-mono text-slate-600 min-w-[110px]">
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
                                          type="button"
                                          onClick={() => updateSiteRate(site.id, parseFloat(newSiteRateValue) || 0)}
                                          className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                                          title="Save"
                                        >
                                          <Check className="w-3 h-3" />
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => setIsUpdatingSiteRate(null)}
                                          className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300 transition"
                                          title="Cancel"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-end gap-1 min-h-[28px]">
                                        <span className="font-semibold">
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
                                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all ml-1"
                                          title="Edit Rate"
                                        >
                                          <Edit className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                  </td>

                                  {/* Unit cell */}
                                  <td className="px-4 py-3.5 text-right text-slate-600 min-w-[110px]">
                                    {isUpdatingSiteUnit === site.id ? (
                                      <div className="flex items-center justify-end gap-1.5">
                                        <input 
                                          type="text" 
                                          value={newSiteUnitValue}
                                          onChange={(e) => setNewSiteUnitValue(e.target.value)}
                                          placeholder="Unit"
                                          className="w-16 bg-white border border-slate-200 rounded px-1.5 py-1 text-xs text-right outline-none focus:ring-1 focus:ring-indigo-550 font-bold"
                                          autoFocus
                                        />
                                        <button 
                                          type="button"
                                          onClick={() => updateSiteUnit(site.id, newSiteUnitValue || 'Files')}
                                          className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                                          title="Save"
                                        >
                                          <Check className="w-3 h-3" />
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => setIsUpdatingSiteUnit(null)}
                                          className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300 transition"
                                          title="Cancel"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-end gap-1 min-h-[28px]">
                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{site.unit || 'Files'}</span>
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            setIsUpdatingSiteUnit(site.id);
                                            setNewSiteUnitValue(site.unit || 'Files');
                                          }}
                                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all ml-1"
                                          title="Edit Unit"
                                        >
                                          <Edit className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                  </td>

                                  {/* Default EP cell */}
                                  <td className="px-4 py-3.5 text-right text-slate-600 bg-indigo-50/10 min-w-[120px]">
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
                                          type="button"
                                          onClick={() => updateSiteDefaultEP(site.id, parseInt(newSiteDefaultEPValue) || 0)}
                                          className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                                          title="Save"
                                        >
                                          <Check className="w-3 h-3" />
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => setIsUpdatingSiteDefaultEP(null)}
                                          className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300 transition"
                                          title="Cancel"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-end gap-1 min-h-[28px]">
                                        <span className="font-bold text-indigo-600 font-mono">{site.default_extra_pages ?? 0}</span>
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            setIsUpdatingSiteDefaultEP(site.id);
                                            setNewSiteDefaultEPValue((site.default_extra_pages ?? 0).toString());
                                          }}
                                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all ml-1"
                                          title="Edit Default Extra Pages"
                                        >
                                          <Edit className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                  </td>

                                  {/* Site Link cell */}
                                  <td className="px-4 py-3.5 text-center min-w-[150px]">
                                    {isUpdatingSiteLink === site.id ? (
                                      <div className="flex items-center justify-center gap-1.5">
                                        <input 
                                          type="text" 
                                          value={newSiteLinkValue}
                                          onChange={(e) => setNewSiteLinkValue(e.target.value)}
                                          placeholder="https://..."
                                          className="w-24 bg-white border border-slate-200 rounded px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                                          autoFocus
                                        />
                                        <button 
                                          type="button"
                                          onClick={() => updateSiteLink(site.id, newSiteLinkValue)}
                                          className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                                          title="Save"
                                        >
                                          <Check className="w-3 h-3" />
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => setIsUpdatingSiteLink(null)}
                                          className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300 transition"
                                          title="Cancel"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-center gap-1 min-h-[28px]">
                                        {site.link ? (
                                          <a 
                                            href={site.link} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors text-[11px] font-semibold"
                                            title={site.link}
                                          >
                                            <Globe className="w-3 h-3" /> Visit Site
                                          </a>
                                        ) : (
                                          <span className="text-slate-300 italic text-xs">No Link</span>
                                        )}
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            setIsUpdatingSiteLink(site.id);
                                            setNewSiteLinkValue(site.link || '');
                                          }}
                                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all ml-1"
                                          title="Edit Site Link"
                                        >
                                          <Edit className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                  </td>

                                  {/* Mouza Entry Link cell */}
                                  <td className="px-4 py-3.5 text-center min-w-[150px]">
                                    {isUpdatingSiteMouzaEntryLink === site.id ? (
                                      <div className="flex items-center justify-center gap-1.5">
                                        <input 
                                          type="text" 
                                          value={newSiteMouzaEntryLinkValue}
                                          onChange={(e) => setNewSiteMouzaEntryLinkValue(e.target.value)}
                                          placeholder="https://..."
                                          className="w-24 bg-white border border-slate-200 rounded px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                                          autoFocus
                                        />
                                        <button 
                                          type="button"
                                          onClick={() => updateSiteMouzaEntryLink(site.id, newSiteMouzaEntryLinkValue)}
                                          className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                                          title="Save"
                                        >
                                          <Check className="w-3 h-3" />
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => setIsUpdatingSiteMouzaEntryLink(null)}
                                          className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300 transition"
                                          title="Cancel"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-center gap-1 min-h-[28px]">
                                        {site.mouza_entry_link ? (
                                          <a 
                                            href={site.mouza_entry_link} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors text-[11px] font-semibold"
                                            title={site.mouza_entry_link}
                                          >
                                            <ExternalLink className="w-3 h-3" /> Entry Form
                                          </a>
                                        ) : (
                                          <span className="text-slate-300 italic text-xs">No Link</span>
                                        )}
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            setIsUpdatingSiteMouzaEntryLink(site.id);
                                            setNewSiteMouzaEntryLinkValue(site.mouza_entry_link || '');
                                          }}
                                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all ml-1"
                                          title="Edit Mouza Entry Link"
                                        >
                                          <Edit className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                  </td>

                                  <td className="px-4 py-3.5 text-right font-mono text-orange-600 font-semibold bg-orange-50/10 min-w-[100px]">
                                    {site.extra_pages?.toLocaleString() || '0'}
                                  </td>
                                  <td className="px-4 py-3.5 text-right font-mono text-slate-700 font-medium min-w-[110px]">
                                    {site.total_files?.toLocaleString() || '0'}
                                  </td>
                                  <td className="px-4 py-3.5 text-right font-mono text-slate-700 font-medium min-w-[110px]">
                                    {site.total_pages?.toLocaleString() || '0'}
                                  </td>
                                  
                                  <td className="px-4 py-3.5 text-center min-w-[80px]">
                                    {confirmDeleteSite === site.id ? (
                                      <div className="flex justify-center gap-1">
                                        <button 
                                          type="button"
                                          onClick={() => handleDeleteSite(site.id)}
                                          className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded hover:bg-red-700"
                                        >
                                          Confirm
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => setConfirmDeleteSite(null)}
                                          className="px-2 py-1 bg-slate-200 text-slate-600 text-[10px] font-bold rounded hover:bg-slate-300"
                                        >
                                          No
                                        </button>
                                      </div>
                                    ) : (
                                      <button 
                                        type="button"
                                        onClick={() => setConfirmDeleteSite(site.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                        title="Delete Site"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                              <tr className="font-bold text-slate-900">
                                <td className="px-4 py-4 text-left text-xs uppercase tracking-wider font-extrabold text-slate-800">GRAND TOTAL</td>
                                <td className="px-4 py-4"></td>
                                <td className="px-4 py-4"></td>
                                <td className="px-4 py-4 text-right font-mono text-indigo-700 bg-indigo-50/20">
                                  {sitesSummary.reduce((sum, s) => sum + (s.default_extra_pages || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-4 py-4"></td>
                                <td className="px-4 py-4"></td>
                                <td className="px-4 py-4 text-right font-mono text-orange-700 bg-orange-50/20">
                                  {sitesSummary.reduce((sum, s) => sum + (s.extra_pages || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-4 py-4 text-right font-mono text-slate-900">
                                  {sitesSummary.reduce((sum, s) => sum + (s.total_files || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-4 py-4 text-right font-mono text-slate-900">
                                  {sitesSummary.reduce((sum, s) => sum + (s.total_pages || 0), 0).toLocaleString()}
                                </td>
                                <td className="px-4 py-4"></td>
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
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-550/20 font-medium"
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
                            type="button"
                            onClick={handleSavePastEP}
                            disabled={isSavingPastEP || isFetchingPastEP || !editPastSiteId}
                            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 h-[38px] flex items-center justify-center gap-2 shadow md:shadow-indigo-550/10 font-inherit"
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
                )}

                {adminActiveTab === 'operators' && hasPermission('admin-operators') && (
                  <motion.div
                    key="tab-operators"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="space-y-6"
                  >
                    <Card className="border-slate-200 bg-white">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
                        <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900">
                          <Users className="w-5 h-5 text-indigo-600" /> Operator Performance & Earnings
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-200 shadow-2xs">
                          {/* Toggle */}
                          <div className="flex bg-slate-205/80 p-0.5 rounded-xl text-xs font-bold leading-none shrink-0 self-start sm:self-auto">
                            <button
                              type="button"
                              onClick={() => setOperatorsFilterType('month')}
                              className={cn(
                                "px-3 py-1.5 rounded-lg transition-all",
                                operatorsFilterType === 'month' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                              )}
                            >
                              Month-wise
                            </button>
                            <button
                              type="button"
                              onClick={() => setOperatorsFilterType('range')}
                              className={cn(
                                "px-3 py-1.5 rounded-lg transition-all",
                                operatorsFilterType === 'range' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                              )}
                            >
                              Custom Range
                            </button>
                          </div>

                          {/* Inputs */}
                          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                            {operatorsFilterType === 'month' ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Month:</span>
                                <input 
                                  type="month" 
                                  value={operatorsMonth}
                                  onChange={(e) => setOperatorsMonth(e.target.value)}
                                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">From:</span>
                                  <input 
                                    type="date" 
                                    value={operatorsStartDate}
                                    onChange={(e) => setOperatorsStartDate(e.target.value)}
                                    className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                  />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">To:</span>
                                  <input 
                                    type="date" 
                                    value={operatorsEndDate}
                                    onChange={(e) => setOperatorsEndDate(e.target.value)}
                                    className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
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
                )}

                {adminActiveTab === 'users' && currentUser?.role === 'admin' && (
                  <motion.div
                    key="tab-users"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                  >
                    <UserControlsPage apiFetch={apiFetch} currentUser={currentUser} />
                  </motion.div>
                  )}

                {adminActiveTab === 'records' && hasPermission('personal-records') && (
                  <motion.div
                    key="tab-records"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="space-y-6"
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
                )}
              </AnimatePresence>
            </motion.div>
          ) : view === 'personal-records' && hasPermission('personal-records') ? (
            <motion.div 
              key="personal-records"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-2 gap-4 border-b border-slate-100">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <TrendingUp className="w-8 h-8 text-indigo-600" />
                    Personal Records
                  </h2>
                  <p className="text-slate-500 font-medium">Your current progress, files, scanned pages, and accumulated extra pages</p>
                </div>
              </div>

              <Card className="lg:col-span-3">
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
          ) : view === 'admin-management' && hasPermission('admin-management') ? (
            <motion.div 
              key="admin-management"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-2 gap-4 border-b border-slate-100">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <Settings className="w-8 h-8 text-indigo-600" />
                    Site Configurations
                  </h2>
                  <p className="text-slate-500 font-medium">Manage sites, options, settings, forecasting, operators, and parameters</p>
                </div>
              </div>

              <div className="space-y-6">
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
                        type="button"
                        onClick={handleAddEmployee}
                        className="w-full bg-emerald-600 text-white py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all font-inherit"
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
                            type="button"
                            onClick={handleUpdateTarget}
                            className="w-full bg-blue-600 text-white py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all font-inherit"
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
                            type="button"
                            onClick={handleUpdateMouza}
                            className="w-full bg-indigo-600 text-white py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all font-inherit"
                          >
                            Update Mouza
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-blue-100/50">
                        <label className="text-[10px] font-bold text-blue-600 uppercase">Site Link (URL)</label>
                        <div className="space-y-2">
                          <input 
                            type="text" 
                            placeholder={sites.find(s => s.id === selectedSiteId)?.link || 'No link set yet'}
                            value={updateLinkValue}
                            onChange={(e) => setUpdateLinkValue(e.target.value)}
                            className="w-full bg-white border border-blue-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/20"
                          />
                          <button 
                            type="button"
                            onClick={handleUpdateLink}
                            className="w-full bg-teal-600 text-white py-2 rounded-xl text-sm font-bold hover:bg-teal-700 transition-all font-inherit"
                          >
                            Update Link
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-blue-100/50">
                        <label className="text-[10px] font-bold text-blue-600 uppercase">Mouza Entry Link (URL)</label>
                        <div className="space-y-2">
                          <input 
                            type="text" 
                            placeholder={sites.find(s => s.id === selectedSiteId)?.mouza_entry_link || 'No Mouza Entry link set yet'}
                            value={updateMouzaEntryLinkValue}
                            onChange={(e) => setUpdateMouzaEntryLinkValue(e.target.value)}
                            className="w-full bg-white border border-blue-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/20"
                          />
                          <button 
                            type="button"
                            onClick={handleUpdateMouzaEntryLink}
                            className="w-full bg-emerald-600 text-white py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all font-inherit"
                          >
                            Update Mouza Entry Link
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
                          <div className="flex items-center justify-between min-h-[36px]">
                            {isEditingOperatorName === operator.employee_id ? (
                              <div className="flex items-center gap-2 w-full mr-1">
                                <input 
                                  type="text" 
                                  value={editingOperatorNameValue}
                                  onChange={(e) => setEditingOperatorNameValue(e.target.value)}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold outline-none focus:ring-1 focus:ring-indigo-500"
                                  placeholder="Operator Name"
                                  autoFocus
                                />
                                <button 
                                  type="button"
                                  onClick={() => updateOperatorName(operator.employee_id, editingOperatorNameValue)}
                                  className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-inherit"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => {
                                    setIsEditingOperatorName(null);
                                    setEditingOperatorNameValue('');
                                  }}
                                  className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 font-inherit"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => {
                                  setIsEditingOperatorName(operator.employee_id);
                                  setEditingOperatorNameValue(operator.name);
                                }}>
                                  <span className="text-sm font-semibold text-slate-700 hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                                    {operator.name}
                                    <Edit className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {confirmDeleteEmployeeId === operator.employee_id ? (
                                    <div className="flex gap-1">
                                      <button 
                                        type="button"
                                        onClick={() => handleDeleteEmployee(operator.employee_id)}
                                        className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-inherit"
                                        title="Confirm Deactivate"
                                      >
                                        <Save className="w-3.5 h-3.5" />
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => setConfirmDeleteEmployeeId(null)}
                                        className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-all font-inherit"
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
                              </>
                            )}
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
                                type="button"
                                onClick={() => updateOperatorRate(operator.employee_id, parseFloat(newRateValue) || 0)}
                                className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-inherit"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button 
                                type="button"
                                onClick={() => setIsUpdatingRate(null)}
                                className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 font-inherit"
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