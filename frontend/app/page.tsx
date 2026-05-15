'use client';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { Code2, Trophy, Wallet, Shield, Zap, Users, Globe, TrendingUp, Star, CreditCard, Bitcoin, CheckCircle, ArrowRight, ChevronRight, Play, Terminal, Award, Flame } from 'lucide-react';

const STATS = [
  { value: 50000, display: '50K+', label: 'Developers', color: 'text-green-400', icon: Users },
  { value: 150,   display: '150+', label: 'Countries',  color: 'text-blue-400',  icon: Globe },
  { value: 2,     display: '$2M+', label: 'Paid Out',   color: 'text-yellow-400',icon: Wallet },
  { value: 100,   display: '100+', label: 'Challenges', color: 'text-purple-400',icon: Code2 },
];

const LIVE_WINS = [
  { name: 'Alex C.',     flag: '🇺🇸', amount: '+$40',  challenge: 'Median of Two Arrays',  time: '2m ago',  lang: 'Python' },
  { name: 'Amara D.',    flag: '🇸🇳', amount: '+$15',  challenge: 'K Closest Points',      time: '4m ago',  lang: 'Java' },
  { name: 'Priya S.',    flag: '🇮🇳', amount: '+$5',   challenge: 'HTML List Builder',     time: '6m ago',  lang: 'JS' },
  { name: 'Carlos L.',   flag: '🇧🇷', amount: '+$40',  challenge: 'N-Queens',              time: '9m ago',  lang: 'C++' },
  { name: 'Fatima R.',   flag: '🇸🇦', amount: '+$15',  challenge: 'Unique Paths II',       time: '12m ago', lang: 'Go' },
  { name: 'Dmitri V.',   flag: '🇷🇺', amount: '+$40',  challenge: 'Word Ladder',           time: '14m ago', lang: 'Rust' },
];

const FEATURES = [
  { icon: Globe,      title: 'Global Tournaments',   desc: 'Compete against developers from 150+ countries in daily, weekly, and monthly tournaments with prize pools up to $10,000.', color: 'from-blue-500/20 to-blue-600/5', border: 'border-blue-800/30', iconBg: 'bg-blue-900/40 text-blue-400' },
  { icon: CreditCard, title: 'Flexible Payments',    desc: 'Deposit & withdraw with Visa, Mastercard, PayPal, Stripe, Mobile Money (MTN/Airtel), or Crypto (BTC/USDT/ETH).', color: 'from-green-500/20 to-green-600/5', border: 'border-green-800/30', iconBg: 'bg-green-900/40 text-green-400' },
  { icon: Code2,      title: 'Professional IDE',     desc: 'Monaco Editor with syntax highlighting, intelligent auto-complete, and support for 12+ languages including Python, Java, and Go.', color: 'from-purple-500/20 to-purple-600/5', border: 'border-purple-800/30', iconBg: 'bg-purple-900/40 text-purple-400' },
  { icon: Shield,     title: 'Integrity System',     desc: 'Advanced behaviour analysis, plagiarism detection, and device fingerprinting ensure every competition is fair.', color: 'from-red-500/20 to-red-600/5', border: 'border-red-800/30', iconBg: 'bg-red-900/40 text-red-400' },
  { icon: TrendingUp, title: 'Skill Rankings',       desc: 'Proprietary ELO rating system. Climb from Beginner to Grandmaster and unlock exclusive high-stakes tournaments.', color: 'from-yellow-500/20 to-yellow-600/5', border: 'border-yellow-800/30', iconBg: 'bg-yellow-900/40 text-yellow-400' },
  { icon: Zap,        title: 'Sub-Second Execution', desc: 'Code runs in isolated containers in under 2 seconds — fair, consistent, and tamper-proof for every participant.', color: 'from-cyan-500/20 to-cyan-600/5', border: 'border-cyan-800/30', iconBg: 'bg-cyan-900/40 text-cyan-400' },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Create your account',  desc: 'Sign up in under 60 seconds. No credit card required.', icon: '👤' },
  { step: '02', title: 'Fund your wallet',      desc: 'Deposit using card, mobile money, PayPal, or crypto.', icon: '💳' },
  { step: '03', title: 'Choose a challenge',    desc: 'Browse 100+ algorithm problems or enter a live contest.', icon: '🧩' },
  { step: '04', title: 'Solve & earn',          desc: 'Pass all test cases and winnings land in your wallet instantly.', icon: '💰' },
];

const TOP_CODERS = [
  { rank: 1, name: 'Alex Chen',        flag: '🇺🇸', solved: 342, earnings: '$4,820', streak: 28 },
  { rank: 2, name: 'Amara Diallo',     flag: '🇸🇳', solved: 298, earnings: '$3,210', streak: 19 },
  { rank: 3, name: 'Priya Sharma',     flag: '🇮🇳', solved: 275, earnings: '$2,940', streak: 14 },
  { rank: 4, name: 'Carlos Lima',      flag: '🇧🇷', solved: 261, earnings: '$2,590', streak: 11 },
  { rank: 5, name: 'Fatima Al-Rashid', flag: '🇸🇦', solved: 248, earnings: '$2,110', streak: 7  },
];

const PAYMENT_METHODS = [
  { label: 'Visa',         icon: '💳', color: 'text-blue-400' },
  { label: 'Mastercard',   icon: '💳', color: 'text-red-400' },
  { label: 'PayPal',       icon: '🅿️', color: 'text-blue-300' },
  { label: 'MTN MoMo',     icon: '📱', color: 'text-yellow-400' },
  { label: 'Airtel Money', icon: '📲', color: 'text-red-400' },
  { label: 'Bitcoin',      icon: '₿',  color: 'text-orange-400' },
  { label: 'USDT',         icon: '💵', color: 'text-green-400' },
  { label: 'Stripe',       icon: '⚡', color: 'text-purple-400' },
];

const CODE_LINES = [
  { text: 'def find_minimum(nums: list[int]) -> int:', color: 'text-blue-400' },
  { text: '    left, right = 0, len(nums) - 1', color: 'text-gray-300' },
  { text: '    while left < right:', color: 'text-purple-400' },
  { text: '        mid = (left + right) // 2', color: 'text-gray-300' },
  { text: '        if nums[mid] < nums[right]:', color: 'text-yellow-300' },
  { text: '            right = mid', color: 'text-gray-300' },
  { text: '        else:', color: 'text-yellow-300' },
  { text: '            left = mid + 1', color: 'text-gray-300' },
  { text: '    return nums[left]  # ✓ Accepted', color: 'text-green-400 font-semibold' },
];

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      observer.disconnect();
      let start = 0;
      const step = target / 60;
      const timer = setInterval(() => {
        start += step;
        if (start >= target) { setCount(target); clearInterval(timer); return; }
        setCount(Math.floor(start));
      }, 16);
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);
  return <span ref={ref}>{count >= 1000 ? `${Math.floor(count / 1000)}K` : count}{suffix}</span>;
}

export default function LandingPage() {
  const [winIdx, setWinIdx] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [typedLines, setTypedLines] = useState(0);

  useEffect(() => {
    setMounted(true);
    const iv = setInterval(() => setWinIdx(i => (i + 1) % LIVE_WINS.length), 2600);
    const codeTimer = setInterval(() => setTypedLines(n => n < CODE_LINES.length ? n + 1 : n), 350);
    return () => { clearInterval(iv); clearInterval(codeTimer); };
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">

      {/* ── Navigation ── */}
      <nav className="border-b border-gray-800/60 px-6 py-4 sticky top-0 z-50 bg-gray-950/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center font-black text-lg shadow-lg shadow-green-900/40 animate-pulse-glow">D</div>
            <span className="font-black text-white text-xl tracking-tight">DevixCode</span>
            <span className="hidden sm:inline text-xs bg-green-900/30 border border-green-800/50 text-green-400 rounded-full px-2 py-0.5">Global</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2">Sign in</Link>
            <Link href="/auth/register" className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition-all hover:-translate-y-0.5 shadow-lg shadow-green-900/30">
              Get started <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(#22c55e 1px,transparent 1px),linear-gradient(90deg,#22c55e 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-green-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 left-10 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-10 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 pt-20 pb-16 lg:pt-28 lg:pb-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left — Text */}
            <div className={mounted ? 'animate-slide-up' : 'opacity-0'}>
              <div className="inline-flex items-center gap-2 bg-green-900/20 border border-green-800/40 text-green-400 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Live competitions · Real money rewards
              </div>

              <h1 className="text-5xl lg:text-6xl xl:text-7xl font-black leading-[1.05] mb-6 tracking-tight">
                Code.<br />
                Compete.<br />
                <span className="bg-gradient-to-r from-green-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">
                  Earn Real Money.
                </span>
              </h1>

              <p className="text-lg text-gray-400 mb-8 leading-relaxed max-w-lg">
                Join 50,000+ developers worldwide solving algorithmic challenges and earning real cash rewards. From Rwanda to the world — compete globally, get paid instantly.
              </p>

              <div className="flex flex-wrap gap-4 mb-10">
                <Link href="/auth/register"
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold px-7 py-3.5 rounded-2xl transition-all hover:-translate-y-0.5 shadow-xl shadow-green-900/30 text-base">
                  Start Competing Free <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/challenges"
                  className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 font-semibold px-7 py-3.5 rounded-2xl transition-all hover:-translate-y-0.5 text-base">
                  <Play className="w-4 h-4" /> Browse Challenges
                </Link>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                {['Free to join', 'Instant payouts', '150+ countries', 'Anti-cheat verified'].map(b => (
                  <span key={b} className="flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />{b}
                  </span>
                ))}
              </div>
            </div>

            {/* Right — Live Dashboard Preview */}
            <div className={`space-y-3 ${mounted ? 'animate-slide-up delay-200' : 'opacity-0'}`}>

              {/* Code editor card */}
              <div className="bg-gray-900/80 border border-gray-700/50 rounded-2xl overflow-hidden shadow-2xl animate-float">
                <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-700/50 bg-gray-800/60">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  <span className="ml-2 text-xs text-gray-500 font-mono">solution.py</span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-xs text-green-400 font-mono">Running…</span>
                  </div>
                </div>
                <div className="p-4 font-mono text-xs leading-6">
                  {CODE_LINES.slice(0, typedLines).map((line, i) => (
                    <div key={i} className={line.color}>{line.text}</div>
                  ))}
                  {typedLines < CODE_LINES.length && (
                    <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-0.5 align-middle" />
                  )}
                </div>
                {typedLines === CODE_LINES.length && (
                  <div className="mx-4 mb-4 bg-green-900/30 border border-green-700/40 rounded-xl px-4 py-2.5 flex items-center gap-3">
                    <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                    <div>
                      <p className="text-green-300 text-xs font-bold">All 6 test cases passed!</p>
                      <p className="text-green-500/70 text-xs">Runtime 42ms · Memory 16.2MB</p>
                    </div>
                    <span className="ml-auto text-green-400 font-black text-sm">+$40</span>
                  </div>
                )}
              </div>

              {/* Live wins ticker */}
              <div className="bg-gray-900/60 border border-gray-700/50 rounded-2xl p-4 overflow-hidden h-[68px] flex items-center relative">
                <div className="absolute left-4 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Live Payouts</span>
                </div>
                {LIVE_WINS.map((w, i) => (
                  <div key={i} className={`absolute inset-x-4 flex items-center gap-3 transition-all duration-500 ${i === winIdx ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <span className="text-xl shrink-0">{w.flag}</span>
                    <div className="flex-1 min-w-0 mt-5">
                      <p className="text-sm text-white font-semibold truncate">
                        <span className="text-gray-400">{w.name}</span> solved <span className="text-gray-300">{w.challenge}</span>
                      </p>
                      <p className="text-xs text-gray-600">{w.lang} · {w.time}</p>
                    </div>
                    <span className="text-green-400 font-black text-sm shrink-0">{w.amount}</span>
                  </div>
                ))}
              </div>

              {/* Mini stats row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Solved today', value: '1,248', color: 'text-blue-400' },
                  { label: 'Active now',   value: '342',   color: 'text-green-400' },
                  { label: 'Prizes today', value: '$8.4K', color: 'text-yellow-400' },
                ].map(s => (
                  <div key={s.label} className="bg-gray-900/60 border border-gray-800/60 rounded-xl p-3 text-center">
                    <p className={`font-black text-base ${s.color}`}>{s.value}</p>
                    <p className="text-gray-600 text-xs mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Banner ── */}
      <section className="border-y border-gray-800/60 bg-gray-900/30 py-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS.map(s => (
              <div key={s.label} className="text-center">
                <div className={`text-4xl font-black ${s.color} mb-1`}>{s.display}</div>
                <div className="text-gray-500 text-sm">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Payment Methods ── */}
      <section className="border-b border-gray-800/40 py-6 bg-gray-900/10">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-gray-600 text-xs uppercase tracking-widest mb-5 font-semibold">Accepted Payment Methods</p>
          <div className="flex flex-wrap justify-center gap-2">
            {PAYMENT_METHODS.map(p => (
              <div key={p.label} className="flex items-center gap-2 bg-gray-900/80 border border-gray-800 rounded-xl px-4 py-2 text-sm text-gray-400 hover:border-gray-600 transition-colors">
                <span>{p.icon}</span><span className={p.color}>{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <p className="text-green-400 text-sm font-semibold uppercase tracking-widest mb-3">Simple Process</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white">Get Paid in 4 Steps</h2>
          <p className="text-gray-500 mt-3">From zero to earning — it takes less than 5 minutes to get started.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {HOW_IT_WORKS.map((h, i) => (
            <div key={h.step} className="relative">
              {i < HOW_IT_WORKS.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-full w-5 z-10 text-center">
                  <ChevronRight className="w-5 h-5 text-gray-700 mx-auto" />
                </div>
              )}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 h-full hover:border-green-900/60 transition-all group hover:-translate-y-1 duration-200">
                <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-2xl mb-4 group-hover:bg-green-900/30 transition-colors">
                  {h.icon}
                </div>
                <span className="text-xs font-black text-green-500 tracking-widest">{h.step}</span>
                <h3 className="font-bold text-white text-base mt-1 mb-2">{h.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{h.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center mb-14">
          <p className="text-green-400 text-sm font-semibold uppercase tracking-widest mb-3">Platform Capabilities</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white">Everything Built for Serious Coders</h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto">Enterprise-grade infrastructure — fair, fast, and transparent.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(f => (
            <div key={f.title}
              className={`relative bg-gradient-to-br ${f.color} border ${f.border} rounded-2xl p-6 group hover:-translate-y-1 transition-all duration-200`}>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${f.iconBg}`}>
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Leaderboard Preview ── */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <div className="text-center mb-10">
          <p className="text-green-400 text-sm font-semibold uppercase tracking-widest mb-3">Top Performers</p>
          <h2 className="text-3xl font-black text-white">This Week's Leaders</h2>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
          <div className="px-6 py-4 border-b border-gray-800 bg-gray-800/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="font-bold text-white text-sm">Global Leaderboard</span>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-green-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Live
            </span>
          </div>
          <div className="divide-y divide-gray-800/60">
            {TOP_CODERS.map((c, i) => (
              <div key={c.rank}
                className={`px-6 py-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors ${i === 0 ? 'bg-yellow-900/5' : ''}`}>
                <div className="flex items-center gap-4">
                  <span className="font-black text-lg w-8 text-center shrink-0">
                    {c.rank === 1 ? '🥇' : c.rank === 2 ? '🥈' : c.rank === 3 ? '🥉' : <span className="text-gray-600 text-base">#{c.rank}</span>}
                  </span>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-600 to-emerald-700 flex items-center justify-center text-sm font-black shadow">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{c.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-gray-500 text-xs">{c.flag} · {c.solved} solved</span>
                      {c.streak > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-orange-400">
                          <Flame className="w-3 h-3" />{c.streak}d
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-green-400 font-black text-sm">{c.earnings}</span>
              </div>
            ))}
          </div>
          <div className="px-6 py-4 border-t border-gray-800 text-center bg-gray-900/30">
            <Link href="/leaderboard" className="inline-flex items-center gap-1.5 text-green-400 hover:text-green-300 text-sm font-semibold transition-colors">
              View full leaderboard <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="relative bg-gradient-to-br from-green-900/25 via-emerald-900/15 to-gray-900/0 border border-green-800/40 rounded-3xl p-10 sm:p-16 text-center overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(#22c55e 1px,transparent 1px),linear-gradient(90deg,#22c55e 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-green-500/15 blur-3xl rounded-full pointer-events-none" />
          <div className="relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-green-900/40 animate-pulse-glow">
              <span className="font-black text-2xl">D</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">Ready to Compete Globally?</h2>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">Free to register. Compete from any country. Real money prizes paid instantly.</p>
            <div className="flex flex-wrap justify-center gap-3 text-sm text-gray-500 mb-8">
              {['Secure & Verified', 'Anti-Cheat Protected', '150+ Countries', 'Instant Payouts'].map(b => (
                <span key={b} className="flex items-center gap-1.5 bg-gray-900/60 border border-gray-800 rounded-full px-3 py-1">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />{b}
                </span>
              ))}
            </div>
            <Link href="/auth/register"
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold px-10 py-4 rounded-2xl transition-all hover:-translate-y-0.5 shadow-xl shadow-green-900/40 text-base">
              Create Free Account <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="text-gray-600 text-xs mt-5">18+ only · Skill-based competitions · See full Terms & Conditions</p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-800/60 bg-gray-900/20">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid sm:grid-cols-3 gap-10 mb-10">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center font-black text-sm">D</div>
                <span className="font-black text-white text-lg">DevixCode</span>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">
                The world's premier skill-based competitive coding platform. Code smarter, compete harder, earn more.
              </p>
              <div className="flex items-center gap-1 text-xs text-gray-600">
                <Shield className="w-3.5 h-3.5" />
                <span>Secure · Fair · Transparent</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Platform</p>
              <div className="space-y-2.5">
                {[{ label: 'Challenges', href: '/challenges' }, { label: 'Contests', href: '/contests' }, { label: 'Leaderboard', href: '/leaderboard' }, { label: 'Wallet', href: '/wallet' }].map(l => (
                  <Link key={l.href} href={l.href} className="block text-sm text-gray-500 hover:text-green-400 transition-colors">{l.label}</Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Company</p>
              <div className="space-y-2.5">
                {['Terms of Service', 'Privacy Policy', 'Cookie Policy', 'Support Center'].map(l => (
                  <a key={l} href="#" className="block text-sm text-gray-500 hover:text-gray-300 transition-colors">{l}</a>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-gray-600 text-xs">
              © 2026 <span className="text-gray-500 font-semibold">Credly Software Solution</span>. All rights reserved.
            </p>
            <p className="text-gray-600 text-xs">DevixCode™ is a registered trademark of Credly Software Solution.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
