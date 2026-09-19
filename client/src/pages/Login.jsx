import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  Building2,
  AlertCircle,
  Terminal,
  Layers
} from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/spaces');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid institutional email or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between py-8 px-4 sm:px-6 relative overflow-hidden bg-[#f8f9ff]">
      {/* Ambient background glows */}
      <div className="absolute inset-0 -z-10 flex items-center justify-center overflow-hidden pointer-events-none">
        <div className="w-[600px] h-[600px] rounded-full bg-blue-200/40 blur-3xl opacity-60 transform -translate-y-12" />
        <div className="w-[420px] h-[420px] rounded-full bg-cyan-200/40 blur-2xl opacity-50 transform translate-x-48 translate-y-24" />
      </div>

      <div className="max-w-md w-full mx-auto relative z-10 my-auto">
        <div className="bg-white rounded-2xl shadow-xl shadow-blue-900/5 p-8 sm:p-10 border border-slate-100 transition-all duration-300">
          {/* Header & Logo */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center p-2 mb-4 shadow-md shadow-blue-500/20 text-white">
              <Layers className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Welcome Back
            </h1>
            <p className="mt-1 text-xs text-slate-500 max-w-xs">
              Continue your academic research and AI-assisted learning
            </p>
          </div>

          {/* Institutional SSO Button */}
          <button
            type="button"
            onClick={() => {
              // Quick demo SSO fill
              setEmail('alex.chen@stanford.edu');
              setPassword('password123');
            }}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-slate-50 hover:bg-slate-100 text-slate-800 font-medium text-xs rounded-xl border border-slate-200 transition-colors group"
          >
            <Building2 className="w-4 h-4 text-blue-600 transition-transform group-hover:scale-110" />
            <span>Continue with Institutional SSO (Demo)</span>
          </button>

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-grow h-px bg-slate-200" />
            <span className="px-3 text-xs text-slate-400 font-medium">or sign in with email</span>
            <div className="flex-grow h-px bg-slate-200" />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="email">
                Institutional / Academic Email
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 text-slate-400 pointer-events-none w-4 h-4" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="alex.chen@university.edu"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700" htmlFor="password">
                  Password
                </label>
                <a href="#forgot" className="text-xs text-blue-600 hover:text-blue-700 transition">
                  Forgot password?
                </a>
              </div>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 text-slate-400 pointer-events-none w-4 h-4" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 focus:outline-none p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 transition"
                />
                <span className="text-xs text-slate-600">
                  Remember this workstation for 30 days
                </span>
              </label>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all duration-200 transform active:scale-[0.99] disabled:opacity-60 group"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Authorizing Secure Session...</span>
                  </>
                ) : (
                  <>
                    <span>Login to Workspace</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-4 text-center bg-slate-50 rounded-xl py-3 px-4 border border-slate-100">
            <p className="text-xs text-slate-600">
              Don't have an academic account?
              <Link
                to="/register"
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-0.5 ml-1"
              >
                Sign Up
                <ArrowRight className="w-3 h-3" />
              </Link>
            </p>
          </div>
        </div>

        {/* Security Tagline */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-center px-4 text-slate-400 text-[11px]">
          <Shield className="w-3.5 h-3.5 text-slate-400" />
          <span>256-bit SSL Encrypted • FERPA & Academic Data Compliant</span>
        </div>

        <div className="w-full mt-3 flex items-center justify-between px-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Cluster: US-West Academic Grid</span>
          </div>
          <div className="flex items-center gap-1">
            <Terminal className="w-3 h-3" />
            <span>v4.18.2</span>
          </div>
        </div>
      </div>

      {/* Institutional Footer */}
      <footer className="w-full pt-8 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400 border-t border-slate-200/60 mt-8">
        <div>© 2025 Cognita Learning Inc. • Institutional Edition</div>
        <nav className="flex flex-wrap items-center gap-4">
          <a href="#privacy" className="hover:text-blue-600 transition-colors">Privacy Policy</a>
          <a href="#terms" className="hover:text-blue-600 transition-colors">Terms of Service</a>
          <a href="#sso" className="hover:text-blue-600 transition-colors">Campus SSO Support</a>
          <a href="#integrity" className="hover:text-blue-600 transition-colors">Academic Integrity</a>
        </nav>
      </footer>
    </div>
  );
}
