import React, { useState, useEffect } from 'react';
import { Lock, User, ShieldAlert, Mail, CheckCircle2, ArrowLeft, BarChart3, Shield, Zap, Users, FileText, TrendingUp, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LoginPageProps {
  onLogin: () => void;
}

const Logo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <div className={`${className} bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/20`}>
    <svg viewBox="0 0 24 24" fill="none" className="w-2/3 h-2/3 text-white" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h10" />
      <path d="M18 15l3 3-3 3" opacity={0.5} />
    </svg>
  </div>
);

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [showLogin, setShowLogin] = useState(false);
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
      setShowLogin(true);
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
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
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

  const features = [
    { icon: BarChart3, title: 'Real-time Dashboard', desc: 'Live scanning stats across all sites instantly' },
    { icon: Users, title: 'Multi-operator Support', desc: 'Manage operators across multiple locations' },
    { icon: FileText, title: 'Excel Reports', desc: 'One-click export of personal & main sheets' },
    { icon: TrendingUp, title: 'Progress Tracking', desc: 'Monthly targets with completion forecasts' },
    { icon: Shield, title: 'Role-based Access', desc: 'Granular permissions for every team member' },
    { icon: Zap, title: 'Daily Reports', desc: 'Automatic email summaries after every save' },
  ];

  const stats = [
    { value: '99.9%', label: 'Uptime' },
    { value: '< 1s', label: 'Response Time' },
    { value: '256-bit', label: 'Encryption' },
    { value: '∞', label: 'Records' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-sans overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-lg font-bold tracking-tight">ScanTrack <span className="text-indigo-400">Pro</span></span>
        </div>
        <button
          onClick={() => { setShowLogin(true); setView('login'); setError(null); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-900/50"
        >
          <Lock className="w-3.5 h-3.5" />
          Sign In
        </button>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-20">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px]" />
          <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-violet-600/8 rounded-full blur-[80px]" />
        </div>

        {/* Grid pattern */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center max-w-4xl mx-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-bold uppercase tracking-widest mb-8"
          >
            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
            Document Scanning Management
          </motion.div>

          <h1 className="text-4xl md:text-7xl font-black tracking-tight mb-8 leading-tight uppercase">
            ScanTrack <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-violet-400 to-indigo-500">Pro</span>
          </h1>

          <p className="text-xl md:text-2xl text-white/50 max-w-3xl mx-auto mb-12 leading-relaxed font-light">
            The industry-leading document scanning and tracking solution. Streamline your office workflow with real-time monitoring and automated executive reporting.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => { setShowLogin(true); setView('login'); setError(null); }}
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold text-base transition-all shadow-2xl shadow-indigo-900/50 flex items-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Access Dashboard
            </button>
            <div className="flex items-center gap-2 text-white/30 text-sm">
              <Shield className="w-4 h-4" />
              Authorized access only
            </div>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <div className="w-px h-16 bg-gradient-to-b from-transparent to-white/20" />
          <span className="text-white/20 text-xs uppercase tracking-widest">Scroll</span>
        </motion.div>
      </section>

      {/* Stats */}
      <section className="px-6 md:px-12 py-20 border-y border-white/5">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="text-3xl md:text-4xl font-black text-indigo-400 mb-1">{s.value}</div>
              <div className="text-white/30 text-sm uppercase tracking-wider">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 md:px-12 py-24">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-black mb-4">Everything you need</h2>
            <p className="text-white/30">Built for scanning operations of any scale</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                viewport={{ once: true }}
                className="p-6 bg-white/3 border border-white/5 rounded-2xl hover:border-indigo-500/20 hover:bg-indigo-600/5 transition-all group"
              >
                <div className="w-10 h-10 bg-indigo-600/15 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-600/25 transition-all">
                  <f.icon className="w-5 h-5 text-indigo-400" />
                </div>
                <h3 className="font-bold text-white mb-1">{f.title}</h3>
                <p className="text-white/30 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 md:px-12 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center p-12 bg-indigo-600/10 border border-indigo-500/20 rounded-3xl relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/5 to-transparent" />
          <div className="relative z-10">
            <h2 className="text-3xl font-black mb-4">Ready to get started?</h2>
            <p className="text-white/40 mb-8">Sign in to access your scanning dashboard</p>
            <button
              onClick={() => { setShowLogin(true); setView('login'); setError(null); }}
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold transition-all shadow-xl shadow-indigo-900/50 flex items-center gap-2 mx-auto"
            >
              <Lock className="w-4 h-4" />
              Sign In to Dashboard
            </button>
          </div>
        </motion.div>
      </section>

      {/* About Section */}
      <section className="px-6 md:px-12 py-24 bg-white/[0.02] border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-black mb-6 leading-tight">
                Professional Document <br />
                <span className="text-indigo-400 text-2xl md:text-3xl">Management Reimagined</span>
              </h2>
              <div className="space-y-4 text-white/40 leading-relaxed">
                <p>
                  ScanTrack Pro was built to solve the complexities of large-scale document scanning operations. From multi-site coordination to real-time operator performance tracking, our platform provides the tools you need to maintain high standards of record management.
                </p>
                <p>
                  Our system ensures that every document is accounted for, providing a clear audit trail and automated reporting that keeps stakeholders informed without the manual overhead.
                </p>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative aspect-video bg-gradient-to-br from-indigo-600/20 to-violet-600/20 rounded-3xl border border-white/10 flex items-center justify-center overflow-hidden group"
            >
              <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/scanning/800/600')] bg-cover bg-center opacity-20 group-hover:opacity-30 transition-opacity" />
              <Logo className="w-20 h-20 relative z-10" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-12 py-8 border-t border-white/5 text-center text-white/20 text-sm">
        © {new Date().getFullYear()} ScanTrack Pro. All rights reserved.
      </footer>

      {/* Login Modal */}
      <AnimatePresence>
        {showLogin && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (view === 'login') setShowLogin(false); }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-[#0f0f1a] border border-white/10 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-center relative">
                  <button
                    onClick={() => setShowLogin(false)}
                    className="absolute right-4 top-4 p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                  <div className="flex flex-col items-center">
                    <Logo className="w-12 h-12 mb-4 bg-white/10" />
                    <h2 className="text-xl font-bold text-white">ScanTrack Pro</h2>
                  </div>
                  <p className="text-white/60 text-sm mt-1">
                    {view === 'login' && 'Sign in to your account'}
                    {view === 'forgot' && 'Reset your password'}
                    {view === 'reset' && 'Set new password'}
                    {view === 'success' && 'Done!'}
                  </p>
                </div>

                <div className="p-6">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-3 mb-5"
                    >
                      <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                      <p>{error}</p>
                    </motion.div>
                  )}

                  <AnimatePresence mode="wait">
                    {view === 'login' && (
                      <motion.form key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Username</label>
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                            <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 transition-all placeholder:text-white/20"
                              placeholder="Enter your username" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Password</label>
                          <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 transition-all placeholder:text-white/20"
                              placeholder="Enter your password" />
                          </div>
                        </div>
                        <button type="submit" disabled={loading}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 mt-2">
                          {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                        <div className="text-center pt-1">
                          <button type="button" onClick={() => { setView('forgot'); setError(null); }}
                            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                            Forgot password?
                          </button>
                        </div>
                      </motion.form>
                    )}

                    {view === 'forgot' && (
                      <motion.form key="forgot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleForgotPassword} className="space-y-4">
                        <p className="text-sm text-white/30">Enter your username and registered email.</p>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Username</label>
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                            <input type="text" required value={forgotUsername} onChange={(e) => setForgotUsername(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-white/20"
                              placeholder="Your username" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Email</label>
                          <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                            <input type="email" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-white/20"
                              placeholder="Your email" />
                          </div>
                        </div>
                        <button type="submit" disabled={loading}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50">
                          {loading ? 'Sending...' : 'Send Reset Link'}
                        </button>
                        <div className="text-center">
                          <button type="button" onClick={() => { setView('login'); setError(null); }}
                            className="text-xs text-white/30 hover:text-white/50 flex items-center gap-1 mx-auto transition-colors">
                            <ArrowLeft className="w-3 h-3" /> Back to login
                          </button>
                        </div>
                      </motion.form>
                    )}

                    {view === 'reset' && (
                      <motion.form key="reset" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleResetPassword} className="space-y-4">
                        <p className="text-sm text-white/30">Enter your new password below.</p>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-white/40 uppercase tracking-wider">New Password</label>
                          <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                            <input type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-white/20"
                              placeholder="Minimum 6 characters" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Confirm Password</label>
                          <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                            <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-white/20"
                              placeholder="Confirm new password" />
                          </div>
                        </div>
                        <button type="submit" disabled={loading}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50">
                          {loading ? 'Resetting...' : 'Reset Password'}
                        </button>
                      </motion.form>
                    )}

                    {view === 'success' && (
                      <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-5 py-2">
                        <div className="flex justify-center">
                          <div className="p-4 bg-emerald-500/10 rounded-2xl">
                            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                          </div>
                        </div>
                        <p className="text-white/40 text-sm">{successMessage}</p>
                        <button onClick={() => { setView('login'); setError(null); setSuccessMessage(''); }}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold text-sm transition-all">
                          Back to Login
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};