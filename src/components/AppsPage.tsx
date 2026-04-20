import React, { useState, useEffect } from 'react';
import { Download, Plus, Trash2, Link as LinkIcon, Image as ImageIcon, FileText, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Apps } from '../types';

interface AppsPageProps {
  currentUser: any;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export default function AppsPage({ currentUser, apiFetch }: AppsPageProps) {
  const [apps, setApps] = useState<Apps[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [newAppUrl, setNewAppUrl] = useState('');
  const [newAppImage, setNewAppImage] = useState('');
  const [newAppDesc, setNewAppDesc] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchApps = async () => {
    try {
      const res = await apiFetch('/api/apps');
      if (res.ok) {
        const data = await res.json();
        setApps(data);
      }
    } catch (err) {
      console.error('Failed to fetch apps:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handleAddApp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const res = await apiFetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAppName,
          download_url: newAppUrl,
          image_url: newAppImage,
          description: newAppDesc
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'App added successfully!' });
        setNewAppName('');
        setNewAppUrl('');
        setNewAppImage('');
        setNewAppDesc('');
        setShowAddModal(false);
        fetchApps();
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.error || 'Failed to add app' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteApp = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this app?')) return;

    try {
      const res = await apiFetch(`/api/apps/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setApps(apps.filter(a => a.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete app:', err);
    }
  };

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 md:mb-12">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Application Center</h1>
          </div>
          <p className="text-slate-500 font-medium">Download required tools and resources for your operations.</p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Add New Application
          </button>
        )}
      </div>

      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`mb-8 p-4 rounded-2xl border ${
              message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'
            } font-bold text-sm flex items-center gap-3`}
          >
            <div className={`w-2 h-2 rounded-full ${message.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-3xl border border-slate-100 p-2 animate-pulse">
              <div className="aspect-video bg-slate-100 rounded-2xl mb-4" />
              <div className="p-4 space-y-3">
                <div className="h-6 bg-slate-100 rounded-lg w-2/3" />
                <div className="h-4 bg-slate-100 rounded-lg w-full" />
                <div className="h-10 bg-slate-100 rounded-xl w-full mt-4" />
              </div>
            </div>
          ))}
        </div>
      ) : apps.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Globe className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No applications available</h3>
          <p className="text-slate-500 max-w-sm mx-auto">Applications and tools will appear here once added by an administrator.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {apps.map((app) => (
            <motion.div
              layout
              key={app.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="group bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 p-2"
            >
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-50 border border-slate-100">
                {app.image_url ? (
                  <img 
                    src={app.image_url} 
                    alt={app.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-200">
                    <ImageIcon className="w-12 h-12" />
                  </div>
                )}
                {isAdmin && (
                  <button
                    onClick={() => handleDeleteApp(app.id)}
                    className="absolute top-2 right-2 p-2 bg-white/90 backdrop-blur-sm text-rose-500 rounded-xl shadow-lg border border-rose-50 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500 hover:text-white"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                   <span className="text-white text-xs font-bold px-2 py-1 bg-white/20 backdrop-blur-md rounded-lg">Version 1.0</span>
                </div>
              </div>

              <div className="p-4 md:p-6">
                <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{app.name}</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-6 font-medium h-10 overflow-hidden line-clamp-2">
                  {app.description || 'No description provided for this application.'}
                </p>
                <a
                  href={app.download_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl font-bold transition-all group-hover:shadow-lg group-hover:shadow-indigo-200"
                >
                  <Download className="w-5 h-5" />
                  Download Drive Link
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add App Modal */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 flex items-center justify-center z-[70] p-4 pointer-events-none"
            >
              <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 pointer-events-auto">
                <div className="bg-indigo-600 p-8 text-white relative">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                      <Plus className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black tracking-tight">Add Application</h2>
                      <p className="text-indigo-100 text-sm font-medium">Create a new tool entry for users</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowAddModal(false)}
                    className="absolute top-6 right-6 p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all"
                  >
                    <Plus className="w-5 h-5 rotate-45" />
                  </button>
                </div>

                <form onSubmit={handleAddApp} className="p-8 space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">App Name</label>
                    <div className="relative">
                      <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        required
                        type="text"
                        value={newAppName}
                        onChange={(e) => setNewAppName(e.target.value)}
                        placeholder="e.g. Scanning Tool Pro"
                        className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Drive link (Download)</label>
                    <div className="relative">
                      <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        required
                        type="url"
                        value={newAppUrl}
                        onChange={(e) => setNewAppUrl(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Program Image (URL)</label>
                    <div className="relative">
                      <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="url"
                        value={newAppImage}
                        onChange={(e) => setNewAppImage(e.target.value)}
                        placeholder="https://image-host.com/app.png"
                        className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                    <textarea
                      value={newAppDesc}
                      onChange={(e) => setNewAppDesc(e.target.value)}
                      placeholder="What does this app do?"
                      rows={3}
                      className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white rounded-2xl font-black text-base shadow-xl shadow-indigo-100 transition-all"
                  >
                    {isSubmitting ? 'Adding...' : 'Add Application'}
                  </button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
