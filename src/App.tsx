import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Database, 
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
  LogOut,
  Eye,
  EyeOff
} from 'lucide-react';
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

// --- Components ---

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("bg-white rounded-2xl border border-black/5 shadow-sm p-6", className)}>
    {children}
  </div>
);

const StatCard = ({ title, value, icon: Icon, colorClass }: { title: string; value: string | number; icon: any; colorClass: string }) => (
  <Card className="flex items-center gap-4">
    <div className={cn("p-3 rounded-xl", colorClass)}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
    </div>
  </Card>
);

// --- Main App ---

export default function App() {
  const [view, setView] = useState<'admin' | 'company'>('company');
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Admin State
  const [adminDate, setAdminDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [adminData, setAdminData] = useState<ScanningData[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [exportMonth, setExportMonth] = useState(format(new Date(), 'yyyy-MM'));

  // Password Change State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({ text: '', isError: false });

  // Company State
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Management State
  const [showManagement, setShowManagement] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteTarget, setNewSiteTarget] = useState('');
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [updateTargetValue, setUpdateTargetValue] = useState('');
  const [confirmDeleteSite, setConfirmDeleteSite] = useState(false);
  const [confirmDeleteEmployeeId, setConfirmDeleteEmployeeId] = useState<number | null>(null);

  useEffect(() => {
    fetchSites();
  }, []);

  useEffect(() => {
    if (selectedSiteId) {
      fetchStats();
      if (view === 'admin') {
        fetchAdminData();
      }
    }
  }, [selectedSiteId, view, adminDate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();
      if (data.success) {
        setIsAuthenticated(true);
        setLoginPassword('');
      } else {
        setLoginError('Invalid username or password');
      }
    } catch (err) {
      setLoginError('Login failed. Please try again.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage({ text: '', isError: false });
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', oldPassword, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        setPasswordMessage({ text: 'Password changed successfully!', isError: false });
        setOldPassword('');
        setNewPassword('');
      } else {
        setPasswordMessage({ text: data.error || 'Failed to change password', isError: true });
      }
    } catch (err) {
      setPasswordMessage({ text: 'Error changing password', isError: true });
    }
  };

  const fetchSites = async () => {
    try {
      const res = await fetch('/api/sites');
      const data = await res.json();
      setSites(data);
      if (data.length > 0) setSelectedSiteId(data[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!selectedSiteId) return;
    try {
      const res = await fetch(`/api/stats/${selectedSiteId}`);
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminData = async () => {
    if (!selectedSiteId) return;
    try {
      const res = await fetch(`/api/scanning-data?siteId=${selectedSiteId}&date=${adminDate}`);
      const data = await res.json();
      setAdminData(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdminChange = (employeeId: number, field: 'files' | 'pages', value: string) => {
    const numValue = value === '' ? null : parseInt(value);
    setAdminData(prev => prev.map(item => 
      item.employee_id === employeeId ? { ...item, [field]: numValue } : item
    ));
  };

  const saveAdminData = async () => {
    setIsSaving(true);
    try {
      await Promise.all(adminData.map(item => 
        fetch('/api/scanning-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: item.employee_id,
            date: adminDate,
            files: item.files || 0,
            pages: item.pages || 0
          })
        })
      ));
      fetchStats();
      // Show success toast or similar
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const downloadReport = () => {
    if (!selectedSiteId) return;
    window.location.href = `/api/export/${selectedSiteId}?month=${exportMonth}`;
  };

  const handleAddSite = async () => {
    if (!newSiteName) return;
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSiteName, target_files: parseInt(newSiteTarget) || 0 })
      });
      const data = await res.json();
      setSites(prev => [...prev, data]);
      setNewSiteName('');
      setNewSiteTarget('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddEmployee = async () => {
    if (!newEmployeeName || !selectedSiteId) return;
    try {
      await fetch('/api/employees', {
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
      await fetch(`/api/sites/${selectedSiteId}`, {
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

  const handleDeleteEmployee = async (id: number) => {
    if (id === undefined || id === null) {
      console.error('Invalid ID provided for deletion');
      return;
    }
    
    try {
      const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
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

  const handleDeleteSite = async () => {
    if (!selectedSiteId) return;
    try {
      const res = await fetch(`/api/sites/${selectedSiteId}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete site');
      }

      const updatedSites = sites.filter(s => s.id !== selectedSiteId);
      setSites(updatedSites);
      if (updatedSites.length > 0) {
        setSelectedSiteId(updatedSites[0].id);
      } else {
        setSelectedSiteId(null);
      }
      setConfirmDeleteSite(false);
      setShowManagement(false);
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
          <h1 className="text-xl font-bold tracking-tight hidden sm:block">ScanTrack Pro</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-slate-100 p-1 rounded-xl flex">
            <button 
              onClick={() => setView('company')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                view === 'company' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden md:inline">Company View</span>
            </button>
            <button 
              onClick={() => setView('admin')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                view === 'admin' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Database className="w-4 h-4" />
              <span className="hidden md:inline">Admin View</span>
            </button>
          </div>

          <select 
            value={selectedSiteId || ''} 
            onChange={(e) => setSelectedSiteId(Number(e.target.value))}
            className="bg-white border border-black/10 rounded-xl px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            {sites.map(site => (
              <option key={site.id} value={site.id}>{site.name}</option>
            ))}
          </select>

          {isAuthenticated && view === 'admin' && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-lg">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Admin Session Active</span>
            </div>
          )}
        </div>
      </nav>

      <main className="pt-24 pb-12 px-4 md:px-8 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {view === 'company' ? (
            <motion.div 
              key="company"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                  title="Total Files" 
                  value={stats?.overall.total_files?.toLocaleString() || '0'} 
                  icon={FileText} 
                  colorClass="bg-blue-500"
                />
                <StatCard 
                  title="Total Pages" 
                  value={stats?.overall.total_pages?.toLocaleString() || '0'} 
                  icon={Layers} 
                  colorClass="bg-indigo-500"
                />
                <StatCard 
                  title="Target Files" 
                  value={stats?.overall.target_files?.toLocaleString() || '0'} 
                  icon={TrendingUp} 
                  colorClass="bg-emerald-500"
                />
                <StatCard 
                  title="Remaining" 
                  value={Math.max(0, (stats?.overall.target_files || 0) - (stats?.overall.total_files || 0)).toLocaleString()} 
                  icon={Plus} 
                  colorClass="bg-orange-500"
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
                            <td className="py-4 text-right font-mono text-slate-600">{m.files.toLocaleString()}</td>
                            <td className="py-4 text-right font-mono text-slate-600">{m.pages.toLocaleString()}</td>
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
                                <td colSpan={2} className="py-4 text-center text-orange-600 font-bold uppercase tracking-widest text-xs">
                                  Sunday - Rest Day
                                </td>
                              ) : (
                                <>
                                  <td className="py-4 text-right font-mono text-slate-600">{dayData?.files.toLocaleString() || '-'}</td>
                                  <td className="py-4 text-right font-mono text-slate-600">{dayData?.pages.toLocaleString() || '-'}</td>
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
            </motion.div>
          ) : (
            !isAuthenticated ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md mx-auto mt-20"
              >
                <Card className="p-8">
                  <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4">
                      <Settings className="w-8 h-8 text-indigo-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">Admin Login</h2>
                    <p className="text-slate-500 text-sm">Please enter your credentials</p>
                  </div>
                  <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Username</label>
                      <input 
                        type="text" 
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Password</label>
                      <div className="relative">
                        <input 
                          type={showLoginPassword ? "text" : "password"} 
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/20 pr-12"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {loginError && (
                      <p className="text-xs font-bold text-red-500 text-center">{loginError}</p>
                    )}
                    <button 
                      type="submit"
                      className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                    >
                      Login
                    </button>
                  </form>
                </Card>
              </motion.div>
            ) : (
              <motion.div 
                key="admin"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
              {/* Summary Cards (Same as Company View) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                  title="Total Files" 
                  value={stats?.overall.total_files?.toLocaleString() || '0'} 
                  icon={FileText} 
                  colorClass="bg-blue-500"
                />
                <StatCard 
                  title="Total Pages" 
                  value={stats?.overall.total_pages?.toLocaleString() || '0'} 
                  icon={Layers} 
                  colorClass="bg-indigo-500"
                />
                <StatCard 
                  title="Target Files" 
                  value={stats?.overall.target_files?.toLocaleString() || '0'} 
                  icon={TrendingUp} 
                  colorClass="bg-emerald-500"
                />
                <StatCard 
                  title="Remaining" 
                  value={Math.max(0, (stats?.overall.target_files || 0) - (stats?.overall.total_files || 0)).toLocaleString()} 
                  icon={Plus} 
                  colorClass="bg-orange-500"
                />
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="relative h-[42px]">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="date" 
                      value={adminDate}
                      onChange={(e) => setAdminDate(e.target.value)}
                      className="bg-white border border-black/10 rounded-xl pl-10 pr-4 h-full text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <button 
                    onClick={saveAdminData}
                    disabled={isSaving}
                    className="bg-indigo-600 text-white px-6 h-[42px] rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Data</>}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 bg-white border border-black/10 rounded-xl px-4 h-[42px]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Report Month:</span>
                    <input 
                      type="month" 
                      value={exportMonth}
                      onChange={(e) => setExportMonth(e.target.value)}
                      className="text-sm font-bold focus:outline-none bg-transparent cursor-pointer"
                    />
                  </div>
                  <button 
                    onClick={downloadReport}
                    className="bg-white border border-black/10 text-slate-700 px-6 h-[42px] rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-50 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    Monthly Excel Report
                  </button>
                  <button 
                    onClick={() => setShowManagement(!showManagement)}
                    className={cn(
                      "px-6 h-[42px] rounded-xl text-sm font-bold flex items-center gap-2 transition-all",
                      showManagement ? "bg-slate-800 text-white" : "bg-white border border-black/10 text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <Settings className="w-4 h-4" />
                    Management
                  </button>
                  <button 
                    onClick={() => setIsAuthenticated(false)}
                    className="bg-white border border-red-100 text-red-600 px-4 h-[42px] rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-red-50 transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {showManagement && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-8 border-b border-slate-100 mb-8">
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
                            <div className="flex gap-2">
                              <input 
                                type="number" 
                                placeholder={stats?.overall.target_files.toString()}
                                value={updateTargetValue}
                                onChange={(e) => setUpdateTargetValue(e.target.value)}
                                className="flex-1 bg-white border border-blue-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/20"
                              />
                              <button 
                                onClick={handleUpdateTarget}
                                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all"
                              >
                                Update
                              </button>
                            </div>
                          </div>
                          
                          <div className="pt-4 border-t border-blue-100">
                            {!confirmDeleteSite ? (
                              <button 
                                type="button"
                                onClick={() => setConfirmDeleteSite(true)}
                                className="w-full bg-white border border-red-200 text-red-600 py-2 rounded-xl text-sm font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete Entire Site
                              </button>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-[10px] text-red-600 font-bold text-center uppercase">Are you absolutely sure?</p>
                                <div className="flex gap-2">
                                  <button 
                                    type="button"
                                    onClick={handleDeleteSite}
                                    className="flex-1 bg-red-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-red-700 transition-all"
                                  >
                                    Yes, Delete
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => setConfirmDeleteSite(false)}
                                    className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>

                      <Card className="lg:col-span-3 border-slate-200 bg-white">
                        <h4 className="font-bold mb-4 flex items-center gap-2 text-slate-900">
                          <Users className="w-4 h-4 text-indigo-600" /> Manage Operators
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          {adminData.filter(op => op.is_active === 1).map(operator => (
                            <div key={operator.employee_id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                              <span className="text-sm font-medium text-slate-700">{operator.name}</span>
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
                                <button 
                                  type="button"
                                  onClick={() => setConfirmDeleteEmployeeId(operator.employee_id)}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  title="Remove Operator"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
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
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Data Entry Table */}
                <Card className="lg:col-span-2">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    Daily Data Entry
                  </h3>
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

                {/* Sidebar with Security and Trends */}
                <div className="space-y-8">
                  <Card className="border-slate-200 bg-slate-50/30">
                    <h4 className="font-bold mb-4 flex items-center gap-2 text-slate-900">
                      <Settings className="w-4 h-4" /> Security Settings
                    </h4>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Old Password</label>
                        <div className="relative">
                          <input 
                            type={showOldPassword ? "text" : "password"} 
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 pr-10"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowOldPassword(!showOldPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-600 uppercase">New Password</label>
                        <div className="relative">
                          <input 
                            type={showNewPassword ? "text" : "password"} 
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 pr-10"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      {passwordMessage.text && (
                        <p className={cn("text-xs font-bold", passwordMessage.isError ? "text-red-500" : "text-emerald-600")}>
                          {passwordMessage.text}
                        </p>
                      )}
                      <button 
                        type="submit"
                        className="w-full bg-slate-800 text-white py-2 rounded-xl text-sm font-bold hover:bg-slate-900 transition-all"
                      >
                        Update Password
                      </button>
                    </form>
                  </Card>

                  <Card>
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-indigo-600" />
                      Last 7 Days Trend
                    </h3>
                    <div className="h-64 w-full">
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

                  <Card>
                    <h3 className="text-lg font-bold mb-4">Quick Stats</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl">
                        <span className="text-sm font-medium text-indigo-600">Avg. Files / Day</span>
                        <span className="font-bold text-indigo-900">
                          {Math.round((stats?.overall.total_files || 0) / Math.max(1, stats?.weekly.length || 1)).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
                        <span className="text-sm font-medium text-emerald-600">Efficiency Index</span>
                        <span className="font-bold text-emerald-900">
                          {stats?.overall.total_files ? Math.round((stats.overall.total_pages || 0) / stats.overall.total_files) : 0} p/f
                        </span>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </main>
    </div>
  );
}
