import React, { useState, useEffect } from 'react';
import { Lock, User, ShieldAlert, Mail, CheckCircle2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LoginPageProps {
  onLogin: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [view, setView] = useState<'login' | 'forgot' | 'reset' | 'success'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setResetToken(token);
      setView('reset');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        if (data.token) localStorage.setItem('authToken', data.token);
        window.location.href = window.location.origin + '/?t=' + Date.now();
        return;
      } else {
        setError(data.error || 'Invalid credentials');
        setLoading(false);
      }
    } catch (err: any) {
      setError('Failed to connect to server');
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: forgotUsername, email: forgotEmail })
      });
      setSuccessMessage('If your username and email match, a reset link has been sent to your email.');
      setView('success');
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMessage('Password reset successfully! You can now login.');
        setView('success');
        window.history.replaceState({}, '', '/');
      } else {
        setError(data.error || 'Failed to reset password');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-3xl shadow-xl border border-black/5 overflow-hidden">
          <div className="bg-indigo-600 p-8 text-center">
            <div className="inline-flex p-4 bg-white/10 rounded-2xl mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">ScanTrack Pro</h2>
            <p className="text-indigo-100 text-sm mt-1">
              {view === 'login' && 'Please sign in to continue'}
              {view === 'forgot' && 'Reset your password'}
              {view === 'reset' && 'Set new password'}
              {view === 'success' && 'Done!'}
            </p>
          </div>

          <div className="p-8">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-3 mb-6"
              >
                <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}

            <AnimatePresence mode="wait">
              {view === 'login' && (
                <motion.form key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Username</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" placeholder="Enter your username" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" placeholder="Enter your password" />
                      </div>
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50">
                    {loading ? 'Signing in...' : 'Sign In'}
                  </button>
                  <div className="text-center">
                    <button type="button" onClick={() => { setView('forgot'); setError(null); }} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
                      Forgot password?
                    </button>
                  </div>
                </motion.form>
              )}

              {view === 'forgot' && (
                <motion.form key="forgot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleForgotPassword} className="space-y-6">
                  <p className="text-sm text-slate-500">Enter your username and registered email. We'll send you a reset link.</p>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Username</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input type="text" required value={forgotUsername} onChange={(e) => setForgotUsername(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" placeholder="Enter your username" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input type="email" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" placeholder="Enter your email" />
                      </div>
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50">
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                  <div className="text-center">
                    <button type="button" onClick={() => { setView('login'); setError(null); }} className="text-xs text-slate-500 hover:text-slate-700 font-medium flex items-center gap-1 mx-auto transition-colors">
                      <ArrowLeft className="w-3 h-3" /> Back to login
                    </button>
                  </div>
                </motion.form>
              )}

              {view === 'reset' && (
                <motion.form key="reset" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleResetPassword} className="space-y-6">
                  <p className="text-sm text-slate-500">Enter your new password below.</p>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">New Password</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" placeholder="Minimum 6 characters" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Confirm Password</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all" placeholder="Confirm new password" />
                      </div>
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50">
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </motion.form>
              )}

              {view === 'success' && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6">
                  <div className="flex justify-center">
                    <div className="p-4 bg-emerald-50 rounded-2xl">
                      <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                    </div>
                  </div>
                  <p className="text-slate-600 text-sm">{successMessage}</p>
                  <button onClick={() => { setView('login'); setError(null); setSuccessMessage(''); }} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all">
                    Back to Login
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
