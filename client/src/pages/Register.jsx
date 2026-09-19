import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  User,
  Mail,
  Lock,
  LockKeyhole,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowRight,
  Shield,
  Building2,
  AlertCircle,
  Layers,
  Sparkles
} from 'lucide-react';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('user');
  const [showPassword, setShowPassword] = useState(false);
  const [agreePolicy, setAgreePolicy] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  // Dynamic Password Strength Calculator
  const passwordStrength = useMemo(() => {
    const len = password.length;
    if (len === 0) return { label: 'Empty', score: 0, color: 'text-slate-400' };
    if (len < 6) return { label: 'Weak', score: 1, color: 'text-red-500' };
    if (len < 10) return { label: 'Fair', score: 2, color: 'text-amber-500' };
    return { label: 'Strong', score: 4, color: 'text-blue-600' };
  }, [password]);

  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!agreePolicy) {
      setError('Please agree to the Academic Integrity Policy');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(name, email, password, role);
      navigate('/spaces');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create academic account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between py-8 px-4 sm:px-6 relative overflow-hidden bg-[#f8f9ff]">
      {/* Ambient glowing blurs */}
      <div className="absolute -top-16 -left-14 w-64 h-64 bg-blue-200/40 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute -bottom-20 -right-12 w-72 h-72 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-xl w-full mx-auto relative z-10 my-auto">
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 sm:p-10 border border-slate-100 transition-all duration-300">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-3 flex items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
                <Layers className="w-8 h-8" />
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-600 border-2 border-white" />
              </span>
            </div>

            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Create Your Academic Account
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              Join thousands of researchers, students, and educators accelerating scholarship with Cognita.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {/* University SSO Button */}
            <button
              type="button"
              onClick={() => {
                setName('Alex Chen');
                setEmail('alex.chen@university.edu');
                setPassword('Password@123');
                setConfirmPassword('Password@123');
              }}
              className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-medium border border-slate-200 transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <Building2 className="w-4 h-4 text-blue-600 transition-transform group-hover:scale-110" />
                <span>Sign up with University Portal (SSO Demo)</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Divider */}
            <div className="flex items-center my-2">
              <div className="flex-grow h-px bg-slate-200" />
              <span className="px-3 text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                or register with email
              </span>
              <div className="flex-grow h-px bg-slate-200" />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Full Name */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between" htmlFor="fullName">
                  <span>Full Name</span>
                  <span className="text-[10px] text-slate-400 font-normal">Required</span>
                </label>
                <div className="relative flex items-center">
                  <User className="absolute left-3.5 text-slate-400 text-sm pointer-events-none w-4 h-4" />
                  <input
                    id="fullName"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Chen"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Academic Email */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between" htmlFor="academicEmail">
                  <span>Academic Email</span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 font-medium">
                    <Shield className="w-3 h-3" /> Institutional
                  </span>
                </label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3.5 text-slate-400 text-sm pointer-events-none w-4 h-4" />
                  <input
                    id="academicEmail"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex.chen@university.edu"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                  Use your .edu or affiliated research email for verified workspace access.
                </p>
              </div>

              {/* Account Role */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Account Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  <option value="user">Academic Researcher / Student</option>
                  <option value="admin">Institutional Administrator</option>
                </select>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700" htmlFor="password">Password</label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3.5 text-slate-400 pointer-events-none w-4 h-4" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a secure password"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Meter */}
                <div className="mt-1 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Security Level</span>
                    <span className={`font-semibold ${passwordStrength.color}`}>{passwordStrength.label}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
                    <div className={`h-full rounded-full transition-all duration-300 ${passwordStrength.score >= 1 ? (passwordStrength.score === 1 ? 'bg-red-500' : passwordStrength.score === 2 ? 'bg-amber-500' : 'bg-blue-600') : 'bg-slate-200'}`} />
                    <div className={`h-full rounded-full transition-all duration-300 ${passwordStrength.score >= 2 ? (passwordStrength.score === 2 ? 'bg-amber-500' : 'bg-blue-600') : 'bg-slate-200'}`} />
                    <div className={`h-full rounded-full transition-all duration-300 ${passwordStrength.score >= 3 ? 'bg-blue-600' : 'bg-slate-200'}`} />
                    <div className={`h-full rounded-full transition-all duration-300 ${passwordStrength.score >= 4 ? 'bg-cyan-500' : 'bg-slate-200'}`} />
                  </div>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700" htmlFor="confirmPassword">Confirm Password</label>
                <div className="relative flex items-center">
                  <LockKeyhole className="absolute left-3.5 text-slate-400 pointer-events-none w-4 h-4" />
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  {passwordsMatch && (
                    <span className="absolute right-3 text-blue-600">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                  )}
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreePolicy}
                    onChange={(e) => setAgreePolicy(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 transition"
                  />
                  <span className="text-[11px] text-slate-600 leading-relaxed select-none">
                    I agree to the <a href="#honor" className="text-blue-600 hover:underline font-medium">Honor Code</a>,{' '}
                    <a href="#integrity" className="text-blue-600 hover:underline font-medium">Academic Integrity Policy</a>, and{' '}
                    <a href="#terms" className="text-blue-600 hover:underline font-medium">Terms of Service</a>.
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-all duration-200 transform active:scale-[0.99] disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Creating Secure Workspace Account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account & Get Started</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-2 pt-3 text-center">
              <p className="text-xs text-slate-500">
                Already have an account?{' '}
                <Link to="/login" className="text-blue-600 hover:underline font-semibold ml-1">
                  Log in
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Security Tagline */}
        <div className="mt-4 flex flex-col items-center justify-center gap-1.5 text-center px-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/80 text-[11px] text-slate-600 font-medium">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            <span>Protected by Cognita Academic Security • Verified Institution Network</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400 mt-1">
            <span>256-bit TLS Vault</span>
            <span>•</span>
            <span>FERPA & GDPR Compliant</span>
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
