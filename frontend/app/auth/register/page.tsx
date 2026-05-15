'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ArrowRight, CheckCircle, Zap, ChevronDown, Search } from 'lucide-react';
import api from '@/lib/api';
import { setAuth } from '@/lib/auth';
import { COUNTRIES } from '@/lib/i18n';

const PERKS = [
  { icon: '💰', text: 'Earn real money for every correct solution' },
  { icon: '🏆', text: 'Compete in global tournaments with prize pools' },
  { icon: '🤖', text: 'AI-powered feedback on every submission' },
  { icon: '🎖️', text: 'Unlock badges and climb the leaderboard' },
  { icon: '⚡', text: 'Instant payouts to 150+ countries' },
];

const MARQUEE_BADGES = [
  '🩸 First Blood', '⚡ Quick Solver', '🔥 3-Day Streak', '💎 100 Solved',
  '🏆 Contest Winner', '🦉 Night Owl', '⭐ Perfect Score', '🌍 Global Top 10',
];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', email: '', password: '', country_code: 'RW',
  });
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');
  const [showPass,      setShowPass]      = useState(false);
  const [showCountry,   setShowCountry]   = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [mounted,       setMounted]       = useState(false);
  const [perkIdx,       setPerkIdx]       = useState(0);

  useEffect(() => {
    setMounted(true);
    const iv = setInterval(() => setPerkIdx(i => (i + 1) % PERKS.length), 2500);
    return () => clearInterval(iv);
  }, []);

  const selectedCountry = COUNTRIES.find(c => c.code === form.country_code) || COUNTRIES[0];
  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const passwordStrength = (p: string) => {
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  };
  const strength = passwordStrength(form.password);
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];
  const strengthColor = ['', 'bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'][strength];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/register', {
        name: form.name, email: form.email,
        password: form.password, country_code: form.country_code,
      });
      setAuth(res.data.token, res.data.user);
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.response?.data?.message || e.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-gray-950">

      {/* ── LEFT PANEL ─────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[44%] relative flex-col bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 border-r border-gray-800 overflow-hidden">

        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#22c55e 1px,transparent 1px),linear-gradient(90deg,#22c55e 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute top-20 left-10 w-64 h-64 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-5  w-56 h-56 bg-emerald-500/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full p-10">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center font-black text-xl shadow-lg shadow-green-900/40 animate-pulse-glow">D</div>
            <span className="text-xl font-black text-white">DevixCode</span>
            <span className="text-xs bg-green-900/30 border border-green-800/50 text-green-400 rounded-full px-2 py-0.5">Global</span>
          </Link>

          <div className={`mb-8 ${mounted ? 'animate-slide-up' : 'opacity-0'}`}>
            <h2 className="text-3xl font-black text-white leading-tight mb-3">
              Start earning<br />
              <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
                with your code
              </span>
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Create your free account and start solving challenges in 60 seconds.
            </p>
          </div>

          {/* Animated perks */}
          <div className={`mb-6 ${mounted ? 'animate-slide-up delay-100' : 'opacity-0'}`}>
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-4 h-16 flex items-center overflow-hidden">
              {PERKS.map((p, i) => (
                <div key={i}
                  className={`absolute flex items-center gap-3 pr-4 transition-all duration-500 ${
                    i === perkIdx ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  }`}>
                  <span className="text-2xl">{p.icon}</span>
                  <p className="text-sm text-gray-200 font-medium">{p.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* All perks list */}
          <div className={`space-y-3 mb-8 ${mounted ? 'animate-slide-up delay-200' : 'opacity-0'}`}>
            {PERKS.map((p, i) => (
              <div key={i} className={`flex items-center gap-3 transition-all duration-300 ${i === perkIdx ? 'opacity-100' : 'opacity-40'}`}>
                <CheckCircle className={`w-4 h-4 shrink-0 ${i === perkIdx ? 'text-green-400' : 'text-gray-600'}`} />
                <span className="text-sm text-gray-300">{p.text}</span>
              </div>
            ))}
          </div>

          {/* Badge marquee */}
          <div className={`mt-auto ${mounted ? 'animate-slide-up delay-300' : 'opacity-0'}`}>
            <p className="text-xs text-gray-600 mb-3 uppercase tracking-wider font-semibold">Earn these badges</p>
            <div className="flex flex-wrap gap-2">
              {MARQUEE_BADGES.map((b, i) => (
                <span key={i} className="text-xs bg-gray-800/70 border border-gray-700/50 text-gray-400 rounded-full px-2.5 py-1">
                  {b}
                </span>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── RIGHT PANEL — FORM ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-10 overflow-y-auto">

        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center font-black">D</div>
          <span className="text-lg font-black text-white">DevixCode</span>
        </div>

        <div className={`w-full max-w-md ${mounted ? 'animate-slide-up' : 'opacity-0'}`}>

          <div className="mb-7">
            <h1 className="text-3xl font-black text-white mb-2">Create account</h1>
            <p className="text-gray-500 text-sm">Free forever · No credit card required</p>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-3 bg-red-900/20 border border-red-800/50 text-red-400 rounded-2xl px-4 py-3 text-sm">
              <span className="w-5 h-5 rounded-full border border-red-500/50 flex items-center justify-center text-xs shrink-0">!</span>
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Full name</label>
              <input
                type="text" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Your full name" required
                className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3.5 text-white placeholder-gray-600
                           focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20
                           hover:border-gray-600 transition-all text-sm"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Email address</label>
              <input
                type="email" value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="you@example.com" required autoComplete="email"
                className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3.5 text-white placeholder-gray-600
                           focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20
                           hover:border-gray-600 transition-all text-sm"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Min. 8 characters" required autoComplete="new-password"
                  className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3.5 pr-12 text-white placeholder-gray-600
                             focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20
                             hover:border-gray-600 transition-all text-sm"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.password && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 flex gap-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength ? strengthColor : 'bg-gray-700'}`} />
                    ))}
                  </div>
                  <span className={`text-xs font-medium ${strength >= 3 ? 'text-green-400' : strength === 2 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {strengthLabel}
                  </span>
                </div>
              )}
            </div>

            {/* Country */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Country</label>
              <div className="relative">
                <button type="button" onClick={() => setShowCountry(v => !v)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3.5 text-white
                             focus:outline-none focus:border-green-500 hover:border-gray-600 transition-all text-sm
                             flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="text-lg">{selectedCountry?.flag}</span>
                    <span>{selectedCountry?.name}</span>
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showCountry ? 'rotate-180' : ''}`} />
                </button>

                {showCountry && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-gray-800">
                      <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-2">
                        <Search className="w-3.5 h-3.5 text-gray-500" />
                        <input autoFocus type="text" placeholder="Search country…"
                          value={countrySearch}
                          onChange={e => setCountrySearch(e.target.value)}
                          className="bg-transparent text-sm text-white placeholder-gray-500 outline-none flex-1" />
                      </div>
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {filteredCountries.slice(0, 50).map(c => (
                        <button key={c.code} type="button"
                          onClick={() => { setForm(p => ({ ...p, country_code: c.code })); setShowCountry(false); setCountrySearch(''); }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-800 transition-colors text-left ${form.country_code === c.code ? 'text-green-400 bg-green-900/10' : 'text-gray-300'}`}>
                          <span className="text-base">{c.flag}</span>
                          <span>{c.name}</span>
                          {form.country_code === c.code && <CheckCircle className="w-3.5 h-3.5 ml-auto text-green-400" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 active:bg-green-700
                         disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl
                         transition-all duration-200 shadow-lg shadow-green-900/30 hover:shadow-green-900/50
                         hover:-translate-y-0.5 active:translate-y-0 mt-1">
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Creating account…
                </>
              ) : (
                <>Create free account <ArrowRight className="w-4 h-4" /></>
              )}
            </button>

            <p className="text-center text-xs text-gray-600">
              By creating an account you agree to our Terms of Service and Privacy Policy.
            </p>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-gray-600">already have an account?</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          <Link href="/auth/login"
            className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700
                       text-gray-200 font-semibold py-3.5 rounded-2xl transition-all text-sm hover:-translate-y-0.5">
            Sign in instead
          </Link>

        </div>
      </div>
    </div>
  );
}
