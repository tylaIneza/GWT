'use client';
import Link from 'next/link';
import { Code2, Trophy, Wallet, Shield, Zap, Users, Globe, TrendingUp, Star, CreditCard, Bitcoin, CheckCircle, ArrowRight, ChevronRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { LANGUAGES } from '@/lib/i18n';
import { useState } from 'react';

const STATS = [
  { value: '50K+',  keyLabel: 'hero_stat_users'     as const },
  { value: '150+',  keyLabel: 'hero_stat_countries'  as const },
  { value: '$2M+',  keyLabel: 'hero_stat_paid'        as const },
];

const PAYMENT_LOGOS = [
  { label: 'Visa',        icon: '💳' },
  { label: 'Mastercard',  icon: '💳' },
  { label: 'PayPal',      icon: '🅿️' },
  { label: 'Stripe',      icon: '⚡' },
  { label: 'MTN MoMo',    icon: '📱' },
  { label: 'Airtel Money',icon: '📲' },
  { label: 'Bitcoin',     icon: '₿'  },
  { label: 'USDT',        icon: '💵' },
];

const TOP_CODERS = [
  { rank: 1, name: 'Alex Chen',        country: '🇺🇸', solved: 342, earnings: '$4,820' },
  { rank: 2, name: 'Amara Diallo',     country: '🇸🇳', solved: 298, earnings: '$3,210' },
  { rank: 3, name: 'Priya Sharma',     country: '🇮🇳', solved: 275, earnings: '$2,940' },
  { rank: 4, name: 'Carlos Lima',      country: '🇧🇷', solved: 261, earnings: '$2,590' },
  { rank: 5, name: 'Fatima Al-Rashid', country: '🇸🇦', solved: 248, earnings: '$2,110' },
];

const FEATURES = [
  { icon: Globe,      title: 'Global Tournaments',    desc: 'Compete against developers from 150+ countries in daily, weekly, and monthly tournaments with prize pools up to $10,000.' },
  { icon: CreditCard, title: 'Flexible Payments',     desc: 'Deposit & withdraw with Visa, Mastercard, PayPal, Stripe, Mobile Money (MTN/Airtel), or Crypto (BTC/USDT/ETH).' },
  { icon: Code2,      title: 'Professional IDE',      desc: 'Monaco Editor with syntax highlighting, intelligent auto-complete, and support for 12+ languages including Python, Java, and Go.' },
  { icon: Shield,     title: 'Integrity System',      desc: 'Advanced behaviour analysis, plagiarism detection, and device fingerprinting ensure every competition is fair.' },
  { icon: TrendingUp, title: 'Skill Rankings',        desc: 'Proprietary ELO rating system. Climb from Beginner to Grandmaster and unlock exclusive high-stakes tournaments.' },
  { icon: Bitcoin,    title: 'Crypto Payouts',        desc: 'Receive winnings in Bitcoin, USDT, or your local currency. Fast, low-fee withdrawals to 150+ countries worldwide.' },
  { icon: Zap,        title: 'Sub-Second Execution',  desc: 'Code runs in isolated containers in under 2 seconds — fair, consistent, and tamper-proof for every participant.' },
  { icon: Users,      title: 'Live Leaderboards',     desc: 'Rankings update in real-time during contests. See your position change as you submit — compete with full transparency.' },
  { icon: Star,       title: 'Referral Programme',    desc: 'Earn a reward for every developer you invite who participates. No cap — share more, earn more.' },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Create your account',    desc: 'Sign up in under 60 seconds. Verify your email and you\'re ready to compete.' },
  { step: '02', title: 'Fund your wallet',        desc: 'Deposit using your preferred payment method — card, mobile money, PayPal, or crypto.' },
  { step: '03', title: 'Choose a challenge',      desc: 'Browse 100+ algorithm problems or enter a live contest with a real prize pool.' },
  { step: '04', title: 'Solve & earn',            desc: 'Submit your solution. Pass all test cases and winnings land in your wallet instantly.' },
];

export default function LandingPage() {
  const { t, lang, setLang } = useI18n();
  const [showLangMenu, setShowLangMenu] = useState(false);

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <nav className="border-b border-gray-800/60 px-6 py-4 sticky top-0 z-50 bg-gray-950/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">

          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center font-black text-lg shadow-lg shadow-green-900/30">D</div>
            <div>
              <span className="font-black text-white text-xl tracking-tight">DevixCode</span>
              <span className="hidden sm:inline-block ml-2 text-xs bg-green-900/30 border border-green-800/50 text-green-400 rounded-full px-2 py-0.5 font-medium">Global</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Language picker */}
            <div className="relative">
              <button
                onClick={() => setShowLangMenu(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800/60 text-gray-300 text-sm hover:border-green-700 transition-colors"
              >
                <Globe className="w-3.5 h-3.5" />
                {LANGUAGES.find(l => l.code === lang)?.flag}
                <span className="hidden sm:block">{LANGUAGES.find(l => l.code === lang)?.name}</span>
              </button>
              {showLangMenu && (
                <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 py-1 min-w-[160px]">
                  {LANGUAGES.map(l => (
                    <button key={l.code} onClick={() => { setLang(l.code); setShowLangMenu(false); }}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-800 transition-colors ${lang === l.code ? 'text-green-400' : 'text-gray-300'}`}>
                      <span>{l.flag}</span>{l.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Link href="/auth/login"    className="btn-ghost text-sm">{t('nav_signin')}</Link>
            <Link href="/auth/register" className="btn-primary text-sm">{t('nav_getstarted')}</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 sm:pt-32 sm:pb-24 text-center">
        <div className="inline-flex items-center gap-2 bg-green-900/20 border border-green-800/40 text-green-400 rounded-full px-4 py-1.5 text-sm font-medium mb-8 shadow-inner">
          <Globe className="w-3.5 h-3.5" /> {t('hero_badge')}
        </div>
        <h1 className="text-5xl sm:text-7xl font-black text-white leading-[1.05] mb-6 tracking-tight">
          {t('hero_title_1')}<br />
          <span className="bg-gradient-to-r from-green-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">
            {t('hero_title_2')}
          </span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          {t('hero_subtitle')}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link href="/auth/register"
            className="btn-primary px-8 py-3.5 text-base inline-flex items-center gap-2 shadow-lg shadow-green-900/30">
            {t('hero_cta_primary')} <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/challenges" className="btn-secondary px-8 py-3.5 text-base">
            {t('hero_cta_secondary')}
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 max-w-md mx-auto">
          {STATS.map(s => (
            <div key={s.keyLabel} className="text-center">
              <div className="text-3xl sm:text-4xl font-black text-white">{s.value}</div>
              <div className="text-gray-500 text-xs mt-1 uppercase tracking-wider">{t(s.keyLabel)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Trusted payments ───────────────────────────────────────────── */}
      <section className="border-y border-gray-800/60 py-7 bg-gray-900/20">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-gray-600 text-xs uppercase tracking-widest mb-5 font-semibold">Accepted Payment Methods</p>
          <div className="flex flex-wrap justify-center gap-3">
            {PAYMENT_LOGOS.map(p => (
              <div key={p.label}
                className="flex items-center gap-2 bg-gray-900/80 border border-gray-800 rounded-xl px-4 py-2 text-sm text-gray-400 hover:border-gray-700 transition-colors">
                <span>{p.icon}</span><span>{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <p className="text-green-400 text-sm font-semibold uppercase tracking-widest mb-3">Simple Process</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white">How DevixCode Works</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {HOW_IT_WORKS.map((h, i) => (
            <div key={h.step} className="relative">
              {i < HOW_IT_WORKS.length - 1 && (
                <ChevronRight className="hidden lg:block absolute -right-3 top-6 w-5 h-5 text-gray-700 z-10" />
              )}
              <div className="card p-6 h-full space-y-3 hover:border-green-900/50 transition-colors">
                <span className="text-xs font-black text-green-500 tracking-widest">{h.step}</span>
                <h3 className="font-bold text-white text-base">{h.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{h.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features grid ──────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center mb-14">
          <p className="text-green-400 text-sm font-semibold uppercase tracking-widest mb-3">Platform Capabilities</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white">Everything You Need to Compete</h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto">Enterprise-grade infrastructure built for the world's most ambitious developers.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-6 space-y-3 hover:border-green-900/40 transition-all group">
              <div className="w-11 h-11 bg-green-900/30 border border-green-800/30 rounded-xl flex items-center justify-center group-hover:bg-green-900/50 transition-colors">
                <f.icon className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="font-bold text-white">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Live leaderboard preview ────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <div className="text-center mb-8">
          <p className="text-green-400 text-sm font-semibold uppercase tracking-widest mb-3">Top Performers</p>
          <h2 className="text-2xl font-black text-white">{t('global_leaderboard')}</h2>
        </div>
        <div className="card overflow-hidden shadow-xl shadow-black/30">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/40">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" /> This Week's Leaders
            </h3>
            <span className="flex items-center gap-1.5 text-xs text-green-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Live
            </span>
          </div>
          <div className="divide-y divide-gray-800/60">
            {TOP_CODERS.map((c) => (
              <div key={c.rank} className="px-6 py-3.5 flex items-center justify-between hover:bg-gray-800/20 transition-colors">
                <div className="flex items-center gap-4">
                  <span className={`font-black text-lg w-8 text-center shrink-0 ${
                    c.rank === 1 ? 'text-yellow-400' : c.rank === 2 ? 'text-gray-300' : c.rank === 3 ? 'text-amber-600' : 'text-gray-600'
                  }`}>
                    {c.rank <= 3 ? ['🥇','🥈','🥉'][c.rank-1] : `#${c.rank}`}
                  </span>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-600 to-emerald-700 flex items-center justify-center text-xs font-bold shadow-sm">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{c.name}</p>
                    <p className="text-gray-500 text-xs">{c.country} · {c.solved} solved</p>
                  </div>
                </div>
                <span className="text-green-400 font-bold text-sm">{c.earnings}</span>
              </div>
            ))}
          </div>
          <div className="px-6 py-4 border-t border-gray-800/60 text-center bg-gray-900/20">
            <Link href="/leaderboard" className="inline-flex items-center gap-1 text-green-400 hover:text-green-300 text-sm font-semibold transition-colors">
              View Full Leaderboard <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 pb-24">
        <div className="card p-10 sm:p-14 text-center bg-gradient-to-br from-green-900/20 via-emerald-900/10 to-transparent border-green-800/30 shadow-xl shadow-black/20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-700 mb-6 shadow-lg shadow-green-900/40">
            <span className="font-black text-2xl">D</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">Ready to Compete Globally?</h2>
          <p className="text-gray-400 mb-2">Free to register · Compete from any country · Real money prizes</p>
          <div className="flex flex-wrap justify-center gap-3 text-sm text-gray-500 mb-8">
            {['Secure & Verified Platform', 'Anti-Cheat Protection', '150+ Countries', 'Instant Payouts'].map(b => (
              <span key={b} className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />{b}
              </span>
            ))}
          </div>
          <Link href="/auth/register" className="btn-primary px-10 py-4 text-base inline-flex items-center gap-2 shadow-lg shadow-green-900/40">
            {t('hero_cta_primary')} <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-gray-600 text-xs mt-5">18+ only · Skill-based competitions · See full Terms & Conditions</p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-800/60 bg-gray-900/30">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-10">
            {/* Brand column */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center font-black text-sm shadow-md">D</div>
                <span className="font-black text-white text-lg tracking-tight">DevixCode</span>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
                The world's premier skill-based competitive coding platform. Code smarter, compete harder, earn more.
              </p>
            </div>

            {/* Platform links */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Platform</p>
              <div className="space-y-2">
                {[
                  { label: 'Challenges', href: '/challenges' },
                  { label: 'Contests',   href: '/contests'   },
                  { label: 'Leaderboard',href: '/leaderboard'},
                  { label: 'Wallet',     href: '/wallet'     },
                ].map(l => (
                  <Link key={l.href} href={l.href}
                    className="block text-sm text-gray-500 hover:text-green-400 transition-colors">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Legal & support */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Company</p>
              <div className="space-y-2">
                {[
                  { label: 'Terms of Service', href: '#' },
                  { label: 'Privacy Policy',   href: '#' },
                  { label: 'Cookie Policy',    href: '#' },
                  { label: 'Support Center',   href: '#' },
                ].map(l => (
                  <a key={l.label} href={l.href}
                    className="block text-sm text-gray-500 hover:text-gray-300 transition-colors">
                    {l.label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-gray-800/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-gray-600 text-xs text-center sm:text-left">
              © 2026 <span className="text-gray-500 font-semibold">Credly Software Solution</span>. All rights reserved.
              DevixCode is a registered trademark of Credly Software Solution.
            </p>
            <div className="flex items-center gap-1 text-gray-600 text-xs">
              <Shield className="w-3 h-3" />
              <span>Secure · Fair · Transparent</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
