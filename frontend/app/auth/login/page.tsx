'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ArrowRight, Code2, Trophy, Zap, Globe, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import { setAuth } from '@/lib/auth';

const STATS = [
  { value: '50K+',  label: 'Developers',  color: 'text-green-400'  },
  { value: '150+',  label: 'Countries',   color: 'text-blue-400'   },
  { value: '$2M+',  label: 'Paid Out',    color: 'text-yellow-400' },
  { value: '100+',  label: 'Challenges',  color: 'text-purple-400' },
];

const RECENT_WINS = [
  { name: 'Alex C.',     country: '🇺🇸', amount: '+$40',  challenge: 'Median of Two Arrays', time: '2m ago' },
  { name: 'Amara D.',    country: '🇸🇳', amount: '+$15',  challenge: 'K Closest Points',     time: '5m ago' },
  { name: 'Priya S.',    country: '🇮🇳', amount: '+$5',   challenge: 'HTML List Builder',    time: '8m ago' },
  { name: 'Carlos L.',   country: '🇧🇷', amount: '+$40',  challenge: 'N-Queens',             time: '11m ago' },
  { name: 'Fatima R.',   country: '🇸🇦', amount: '+$15',  challenge: 'Unique Paths',         time: '14m ago' },
];

const CODE_SNIPPET = `def solve(nums: list[int]) -> int:
    left, right = 0, len(nums) - 1
    while left < right:
        mid = (left + right) // 2
        if nums[mid] < nums[right]:
            right = mid
        else:
            left = mid + 1
    return nums[left]  # ✓ Accepted`;

export default function LoginPage() {
  const router = useRouter();
  const [form,      setForm]      = useState({ email: '', password: '' });
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [winIdx,    setWinIdx]    = useState(0);
  const [mounted,   setMounted]   = useState(false);

  useEffect(() => {
    setMounted(true);
    const iv = setInterval(() => setWinIdx(i => (i + 1) % RECENT_WINS.length), 2800);
    return () => clearInterval(iv);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/login', form);
      setAuth(res.data.token, res.data.user);
      router.push(res.data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (e: any) {
      const data = e.response?.data;
      setError(data?.message || 'Invalid email or password');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-gray-950">

      {/* ── LEFT PANEL ─────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 border-r border-gray-800 overflow-hidden">

        {/* Background grid */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#22c55e 1px,transparent 1px),linear-gradient(90deg,#22c55e 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Glow orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 right-10 w-64 h-64 bg-emerald-500/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full p-10">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center font-black text-xl shadow-lg shadow-green-900/40 animate-pulse-glow">
              D
            </div>
            <span className="text-xl font-black text-white tracking-tight">DevixCode</span>
            <span className="text-xs bg-green-900/30 border border-green-800/50 text-green-400 rounded-full px-2 py-0.5">Global</span>
          </Link>

          {/* Headline */}
          <div className={`mb-8 ${mounted ? 'animate-slide-up' : 'opacity-0'}`}>
            <h2 className="text-4xl font-black text-white leading-tight mb-3">
              Code. Compete.<br />
              <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
                Earn Real Money.
              </span>
            </h2>
            <p className="text-gray-400 text-base leading-relaxed">
              Join 50,000+ developers worldwide solving algorithmic challenges and earning real cash rewards instantly.
            </p>
          </div>

          {/* Stats grid */}
          <div className={`grid grid-cols-2 gap-3 mb-8 ${mounted ? 'animate-slide-up delay-100' : 'opacity-0'}`}>
            {STATS.map((s) => (
              <div key={s.label} className="bg-gray-800/50 border border-gray-700/50 rounded-2xl px-4 py-3 backdrop-blur-sm">
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-gray-500 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Live wins ticker */}
          <div className={`mb-8 ${mounted ? 'animate-slide-up delay-200' : 'opacity-0'}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Live Payouts</span>
            </div>
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-4 overflow-hidden h-16 flex items-center">
              {RECENT_WINS.map((w, i) => (
                <div key={i}
                  className={`absolute flex items-center gap-3 w-full transition-all duration-500 ${
                    i === winIdx ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  }`}>
                  <span className="text-xl">{w.country}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{w.name} solved <span className="text-gray-400">{w.challenge}</span></p>
                    <p className="text-xs text-gray-500">{w.time}</p>
                  </div>
                  <span className="text-green-400 font-black text-sm shrink-0">{w.amount}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Code snippet */}
          <div className={`flex-1 ${mounted ? 'animate-slide-up delay-300' : 'opacity-0'}`}>
            <div className="bg-gray-900/80 border border-gray-700/50 rounded-2xl overflow-hidden animate-float">
              <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-700/50 bg-gray-800/40">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
                <span className="ml-2 text-xs text-gray-500 font-mono">solution.py</span>
              </div>
              <pre className="p-4 text-xs font-mono text-gray-300 leading-relaxed overflow-hidden">
                {CODE_SNIPPET.split('\n').map((line, i) => (
                  <div key={i} className={`${
                    line.includes('# ✓') ? 'text-green-400 font-semibold' :
                    line.includes('def ')   ? 'text-blue-400' :
                    line.includes('return') ? 'text-yellow-300' :
                    line.includes('while')  ? 'text-purple-400' : ''
                  }`}>{line}</div>
                ))}
              </pre>
            </div>
          </div>

        </div>
      </div>

      {/* ── RIGHT PANEL — FORM ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12">

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center font-black">D</div>
          <span className="text-lg font-black text-white">DevixCode</span>
        </div>

        <div className={`w-full max-w-md ${mounted ? 'animate-slide-up' : 'opacity-0'}`}>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-black text-white mb-2">Welcome back</h1>
            <p className="text-gray-500">Sign in to continue competing and earning</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-center gap-3 bg-red-900/20 border border-red-800/50 text-red-400 rounded-2xl px-4 py-3 text-sm animate-slide-up">
              <span className="w-5 h-5 rounded-full border border-red-500/50 flex items-center justify-center text-xs shrink-0">!</span>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={submit} className="space-y-4">

            {/* Email */}
            <div className="group">
              <label className="block text-sm font-medium text-gray-400 mb-2">Email address</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="you@example.com"
                required autoComplete="email"
                className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3.5 text-white placeholder-gray-600
                           focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20
                           hover:border-gray-600 transition-all text-sm"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-400">Password</label>
                <Link href="/auth/forgot-password" className="text-xs text-green-400 hover:text-green-300 transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                  required autoComplete="current-password"
                  className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3.5 pr-12 text-white placeholder-gray-600
                             focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20
                             hover:border-gray-600 transition-all text-sm"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 active:bg-green-700
                         disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl
                         transition-all duration-200 shadow-lg shadow-green-900/30 hover:shadow-green-900/50
                         hover:-translate-y-0.5 active:translate-y-0 mt-2">
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Signing in…
                </>
              ) : (
                <>Sign In <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-gray-600">or</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          {/* Register link */}
          <p className="text-center text-gray-500 text-sm">
            Don't have an account?{' '}
            <Link href="/auth/register" className="text-green-400 hover:text-green-300 font-semibold transition-colors">
              Create account →
            </Link>
          </p>

          {/* Demo credentials */}
          <div className="mt-6 bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-xs font-semibold text-gray-400">Quick test accounts</span>
            </div>
            <div className="space-y-2">
              <button onClick={() => setForm({ email: 'inezapaccy4@gmail.com', password: 'Ineza@12' })}
                className="w-full flex items-center justify-between bg-gray-800/60 hover:bg-gray-800 rounded-xl px-3 py-2.5 text-left transition-colors group">
                <div>
                  <p className="text-xs font-semibold text-white group-hover:text-green-400 transition-colors">Admin Account</p>
                  <p className="text-xs text-gray-500">inezapaccy4@gmail.com</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-purple-900/40 text-purple-400 border border-purple-800/40 rounded-full px-2 py-0.5">Admin</span>
                  <ArrowRight className="w-3 h-3 text-gray-600 group-hover:text-green-400 transition-colors" />
                </div>
              </button>
              <button onClick={() => setForm({ email: 'testuser@codearena.com', password: 'Test@1234' })}
                className="w-full flex items-center justify-between bg-gray-800/60 hover:bg-gray-800 rounded-xl px-3 py-2.5 text-left transition-colors group">
                <div>
                  <p className="text-xs font-semibold text-white group-hover:text-green-400 transition-colors">User Account</p>
                  <p className="text-xs text-gray-500">testuser@codearena.com</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-blue-900/40 text-blue-400 border border-blue-800/40 rounded-full px-2 py-0.5">User</span>
                  <ArrowRight className="w-3 h-3 text-gray-600 group-hover:text-green-400 transition-colors" />
                </div>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
