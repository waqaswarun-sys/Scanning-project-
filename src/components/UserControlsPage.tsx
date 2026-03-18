import React, { useState } from 'react';
import { User, Lock, Save, AlertCircle, CheckCircle2, Users, Plus, Trash2, Shield, Key, X, Check, Settings } from 'lucide-react';
import { motion } from 'motion/react';

interface UserControlsPageProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  currentUser: any;
}

export default function UserControlsPage({ apiFetch, currentUser }: UserControlsPageProps) {
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // User Management State
  const [users, setUsers] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [newUserPermissions, setNewUserPermissions] = useState<string[]>(['main-view']);
  const [newUserSiteAccess, setNewUserSiteAccess] = useState<number[]>([]);
  const [newUserEmployeeId, setNewUserEmployeeId] = useState<number | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [allOperators, setAllOperators] = useState<any[]>([]);

  const availablePermissions = [
    { id: 'main-view', label: 'Dashboard' },
    { id: 'personal-records', label: 'Personal Records' },
    { id: 'admin-data-entry', label: 'Data Entry' },
    { id: 'admin-reports', label: 'Downloads' },
    { id: 'admin-sites', label: 'Manage Sites' },
    { id: 'admin-operators', label: 'Operators' },
    { id: 'operator-summary', label: 'Operator Summary' },
    { id: 'admin-management', label: 'Settings' },
  ];

  React.useEffect(() => {
    if (currentUser?.role === 'admin') {
      fetchUsers();
      fetchSites();
      fetchAllOperators();
    }
  }, [currentUser]);

  const fetchAllOperators = async () => {
    try {
      const res = await apiFetch('/api/all-operators');
      if (res.ok) {
        const data = await res.json();
        setAllOperators(data);
      }
    } catch (err) {
      console.error('Failed to fetch operators:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await apiFetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const fetchSites = async () => {
    try {
      const res = await apiFetch('/api/sites');
      if (res.ok) {
        const data = await res.json();
        setSites(data);
      }
    } catch (err) {
      console.error('Failed to fetch sites:', err);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = editingUserId ? `/api/users/${editingUserId}` : '/api/users';
      const method = editingUserId ? 'PUT' : 'POST';
      
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUserName,
          password: newUserPassword || undefined,
          role: newUserRole,
          permissions: newUserPermissions,
          site_access: newUserSiteAccess,
          employee_id: newUserEmployeeId,
          email: newUserEmail || undefined
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: editingUserId ? 'User updated' : 'User created' });
        setNewUserName('');
        setNewUserPassword('');
        setNewUserEmail('');
        setNewUserPermissions(['main-view']);
        setNewUserSiteAccess([]);
        setNewUserEmployeeId(null);
        setShowAddUser(false);
        setEditingUserId(null);
        fetchUsers();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Operation failed' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'An error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const deleteUser = async (id: number) => {
    try {
      const res = await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchUsers();
        setConfirmDeleteId(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const togglePermission = (permId: string) => {
    setNewUserPermissions(prev => 
      prev.includes(permId) 
        ? prev.filter(p => p !== permId) 
        : [...prev, permId]
    );
  };

  const toggleSiteAccess = (siteId: number) => {
    setNewUserSiteAccess(prev => 
      prev.includes(siteId) 
        ? prev.filter(id => id !== siteId) 
        : [...prev, siteId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword && newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username || undefined,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Profile updated successfully' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update profile' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="space-y-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">My Profile</h2>
                <p className="text-sm text-slate-500">Update your personal account details</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {message && !showAddUser && (
              <div className={`p-4 rounded-xl flex items-center gap-3 ${
                message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
              }`}>
                {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                <p className="text-sm font-medium">{message.text}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Username (Optional)</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    placeholder="Enter new username"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Change Password
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      placeholder="Required to change password"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Profile Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {currentUser?.role === 'admin' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">User Management</h2>
                  <p className="text-sm text-slate-500">Create and manage team accounts</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowAddUser(!showAddUser);
                  setEditingUserId(null);
                  setNewUserName('');
                  setNewUserPassword('');
                  setNewUserPermissions(['main-view']);
                  setNewUserSiteAccess([]);
                  setNewUserEmployeeId(null);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
              >
                {showAddUser ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showAddUser ? 'Cancel' : 'Add New User'}
              </button>
            </div>

            <div className="p-6">
              {showAddUser && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-200"
                >
                  <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    {editingUserId ? 'Edit User' : 'Create New Account'}
                  </h3>
                  <form onSubmit={handleAddUser} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Username</label>
                        <input 
                          type="text"
                          required
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                          {editingUserId ? 'New Password (Optional)' : 'Password'}
                        </label>
                        <input 
                          type="password"
                          required={!editingUserId}
                          value={newUserPassword}
                          onChange={(e) => setNewUserPassword(e.target.value)}
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Email (for password reset)</label>
                      <input 
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      />
                      <p className="mt-1 text-[10px] text-slate-400 italic">Required for forgot password feature.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Page Access (Permissions)</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {availablePermissions.map(perm => (
                          <label 
                            key={perm.id}
                            className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                              newUserPermissions.includes(perm.id) 
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <input 
                              type="checkbox"
                              className="hidden"
                              checked={newUserPermissions.includes(perm.id)}
                              onChange={() => togglePermission(perm.id)}
                            />
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                              newUserPermissions.includes(perm.id) ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'
                            }`}>
                              {newUserPermissions.includes(perm.id) && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-xs font-bold">{perm.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Site Access (Select Sites)</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {sites.map(site => (
                          <label 
                            key={site.id}
                            className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                              newUserSiteAccess.includes(site.id) 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <input 
                              type="checkbox"
                              className="hidden"
                              checked={newUserSiteAccess.includes(site.id)}
                              onChange={() => toggleSiteAccess(site.id)}
                            />
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                              newUserSiteAccess.includes(site.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                            }`}>
                              {newUserSiteAccess.includes(site.id) && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-xs font-bold">{site.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Link to Operator (Optional)</label>
                      <select 
                        value={newUserEmployeeId || ''}
                        onChange={(e) => setNewUserEmployeeId(e.target.value ? Number(e.target.value) : null)}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm"
                      >
                        <option value="">None (Not an operator)</option>
                        {allOperators.map(op => (
                          <option key={op.id} value={op.id}>{op.name} ({op.site_name})</option>
                        ))}
                      </select>
                      <p className="mt-1 text-[10px] text-slate-400 italic">If linked, this user will only see their own summary.</p>
                    </div>

                    <button 
                      type="submit"
                      disabled={loading}
                      className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {editingUserId ? 'Update User' : 'Create User'}
                    </button>
                  </form>
                </motion.div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 font-bold border-b border-slate-100">
                      <th className="text-left pb-3">Username</th>
                      <th className="text-left pb-3">Role</th>
                      <th className="text-left pb-3">Allowed Pages</th>
                      <th className="text-right pb-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {users.map(user => (
                      <tr key={user.id} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 font-bold text-slate-700">{user.username}</td>
                        <td className="py-4">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                            user.role === 'admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="py-4">
                          <div className="flex flex-wrap gap-1">
                            {user.role === 'admin' ? (
                              <span className="text-xs text-slate-400 italic">All Access</span>
                            ) : (
                              user.permissions.map((p: string) => (
                                <span key={p} className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] text-slate-500 font-medium">
                                  {availablePermissions.find(ap => ap.id === p)?.label || p}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="py-4 text-right">
                          {user.username !== 'admin' && user.id !== currentUser?.id && (
                            <div className="flex items-center justify-end gap-2">
                              {confirmDeleteId === user.id ? (
                                <div className="flex items-center gap-1">
                                  <button 
                                    onClick={() => deleteUser(user.id)}
                                    className="px-2 py-1 bg-rose-600 text-white text-[10px] font-bold rounded-md hover:bg-rose-700"
                                  >
                                    Confirm
                                  </button>
                                  <button 
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-2 py-1 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-md hover:bg-slate-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button 
                                    onClick={() => {
                                      setEditingUserId(user.id);
                                      setNewUserName(user.username);
                                      setNewUserRole(user.role);
                                      setNewUserPermissions(user.permissions);
                                      setNewUserSiteAccess(Array.isArray(user.site_access) ? user.site_access : []);
                                      setNewUserEmployeeId(user.employee_id);
                                      setNewUserEmail(user.email || '');
                                      setNewUserPassword('');
                                      setShowAddUser(true);
                                    }}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                  >
                                    <Settings className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => setConfirmDeleteId(user.id)}
                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
