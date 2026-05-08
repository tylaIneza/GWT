'use client';
import Link from 'next/link';
import { Code2, Trophy, Wallet, Shield, Zap, Users, Globe, TrendingUp, Star, CreditCard, Bitcoin } from 'lucide-react';
import { useI18n } from '@/lib/i18n-context';
import { LANGUAGES } from '@/lib/i18n';
import { useState } from 'react';

const STATS = [
  { value: '50K+', keyLabel: 'hero_stat_users' as const },
  { value: '150+', keyLabel: 'hero_stat_countries' as const },
  { value: '$2M+', keyLabel: 'hero_stat_paid' as const },
];

const PAYMENT_LOGOS = [
  { label: 'Visa', icon: '💳' },
  { label: 'Mastercard', icon: '💳' },
  { label: 'PayPal', icon: '🅿️' },
  { label: 'Stripe', icon: '⚡' },
  { label: 'MTN MoMo', icon: '📱' },
  { label: 'Airtel', icon: '📲' },
  { label: 'Bitcoin', icon: '₿' },
  { label: 'USDT', icon: '💵' },
];

const TOP_CODERS = [
  { rank: 1, name: 'Alex Chen', country: '🇺🇸', solved: 342, earnings: '$4,820' },
  { rank: 2, name: 'Amara Diallo', country: '🇸🇳', solved: 298, earnings: '$3,210' },
  { rank: 3, name: 'Priya Sharma', country: '🇮🇳', solved: 275, earnings: '$2,940' },
  { rank: 4, name: 'Carlos Lima', country: '🇧🇷', solved: 261, earnings: '$2,590' },
  { rank: 5, name: 'Fatima Al-Rashid', country: '🇸🇦', solved: 248, earnings: '$2,110' },
];

export default function LandingPage() {
  const { t, lang, setLang } = useI18n();
  const [showLangMenu, setShowLangMenu] = useState(false);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 sticky top-0 z-50 bg-gray-950/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center font-black text-lg">C</div>
            <span className="font-bold text-white text-xl">CodeArena</span>
            <span className="hidden sm:block ml-2 text-xs bg-green-900/30 border border-green-800/50 text-green-400 rounded-full px-2 py-0.5">Global</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Language picker */}
            <div className="relative">
              <button
                onClick={() => setShowLangMenu(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 text-sm hover:border-green-700 transition-colors"
              >
                <Globe className="w-3.5 h-3.5" />
                {LANGUAGES.find(l => l.code === lang)?.flag}
                <span className="hidden sm:block">{LANGUAGES.find(l => l.code === lang)?.name}</span>
              </button>
              {showLangMenu && (
                <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 py-1 min-w-[160px]">
                  {LANGUAGES.map(l => (
                    <button key={l.code} onClick={() => { setLang(l.code); setShowLangMenu(false); }}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-800 transition-colors ${lang === l.code ? 'text-green-400' : 'text-gray-300'}`}>
                      <span>{l.flag}</span>{l.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Link href="/auth/login" className="btn-ghost text-sm">{t('nav_signin')}</Link>
            <Link href="/auth/register" className="btn-primary text-sm">{t('nav_getstarted')}</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-20 sm:py-28 text-center">
        <div className="inline-flex items-center gap-2 bg-green-900/30 border border-green-800/50 text-green-400 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
          <Globe className="w-3.5 h-3.5" /> {t('hero_badge')}
        </div>
        <h1 className="text-5xl sm:text-7xl font-black text-white leading-tight mb-6">
          {t('hero_title_1')}<br />
          <span className="bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
            {t('hero_title_2')}
          </span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          {t('hero_subtitle')}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link href="/auth/register" className="btn-primary px-8 py-3.5 text-base">{t('hero_cta_primary')}</Link>
          <Link href="/challenges" className="btn-secondary px-8 py-3.5 text-base">{t('hero_cta_secondary')}</Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 max-w-lg mx-auto">
          {STATS.map(s => (
            <div key={s.keyLabel} className="text-center">
              <div className="text-3xl font-black text-white">{s.value}</div>
              <div className="text-gray-500 text-xs mt-1">{t(s.keyLabel)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Payment methods */}
      <section className="border-y border-gray-800 py-6 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-gray-600 text-xs uppercase tracking-widest mb-5">Supported Payment Methods</p>
          <div className="flex flex-wrap justify-center gap-4">
            {PAYMENT_LOGOS.map(p => (
              <div key={p.label} className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-400">
                <span>{p.icon}</span>{p.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black text-white mb-3">Everything You Need to Compete</h2>
          <p className="text-gray-500">World-class tools for the world's best coders</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Globe,       title: 'Global Tournaments',    desc: 'Compete against coders from 150+ countries in daily, weekly, and monthly tournaments with prize pools up to $10,000.' },
            { icon: CreditCard,  title: 'Global Payments',       desc: 'Deposit & withdraw with Visa, Mastercard, PayPal, Stripe, Mobile Money (MTN/Airtel), or Crypto (BTC/USDT).' },
            { icon: Code2,       title: 'Pro Code Editor',       desc: 'Monaco Editor with syntax highlighting, auto-complete, and support for JavaScript, Python, and more.' },
            { icon: Shield,      title: 'Anti-Cheat System',     desc: 'Advanced behavior tracking, plagiarism detection, and device fingerprinting to ensure fair competition.' },
            { icon: TrendingUp,  title: 'Skill Rankings',        desc: 'Global ELO-based rating system. Climb from Beginner to Grandmaster and unlock exclusive tournaments.' },
            { icon: Bitcoin,     title: 'Crypto Payouts',        desc: 'Receive winnings in Bitcoin, USDT, or your local currency. Fast withdrawals to 150+ countries.' },
            { icon: Zap,         title: 'Instant Execution',     desc: 'Code runs in isolated Docker containers in under 2 seconds. Fair, consistent, and secure.' },
            { icon: Users,       title: 'Live Leaderboards',     desc: 'Watch rankings update in real-time during contests. Compete, not just participate.' },
            { icon: Star,        title: 'Referral Rewards',      desc: 'Earn $5 for every friend you invite who competes. No limit — the more you share, the more you earn.' },
          ].map((f) => (
            <div key={f.title} className="card p-6 space-y-3 hover:border-green-900/50 transition-colors">
              <div className="w-10 h-10 bg-green-900/30 border border-green-800/30 rounded-xl flex items-center justify-center">
                <f.icon className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="font-bold text-white">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live leaderboard preview */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              {t('global_leaderboard')}
            </h3>
            <span className="badge-green text-xs">Live</span>
          </div>
          <div className="divide-y divide-gray-800">
            {TOP_CODERS.map((c) => (
              <div key={c.rank} className="px-6 py-3.5 flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                <div className="flex items-center gap-4">
                  <span className={`font-black text-lg w-8 text-center ${c.rank === 1 ? 'text-yellow-400' : c.rank === 2 ? 'text-gray-300' : c.rank === 3 ? 'text-amber-600' : 'text-gray-600'}`}>
                    {c.rank === 1 ? '🥇' : c.rank === 2 ? '🥈' : c.rank === 3 ? '🥉' : `#${c.rank}`}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-green-700 flex items-center justify-center text-xs font-bold">
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
          <div className="px-6 py-4 border-t border-gray-800 text-center">
            <Link href="/leaderboard" className="text-green-400 hover:text-green-300 text-sm font-medium">
              View Full Leaderboard →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <div className="card p-10 bg-gradient-to-br from-green-900/20 to-emerald-900/10 border-green-800/30">
          <div className="text-4xl mb-4">🌍</div>
          <h2 className="text-3xl font-black text-white mb-3">Ready to Compete Globally?</h2>
          <p className="text-gray-400 mb-6">Free to register · Compete from any country · Real money prizes</p>
          <Link href="/auth/register" className="btn-primary px-8 py-3.5 text-base inline-flex">
            {t('hero_cta_primary')}
          </Link>
          <p className="text-gray-600 text-xs mt-4">18+ · Skill-based competitions only · Terms apply</p>
        </div>
      </section>

      <footer className="border-t border-gray-800 py-8 text-center text-gray-600 text-sm">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center font-black text-xs">C</div>
            <span>© 2026 CodeArena · Global Skill-Based Platform</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-gray-400 transition-colors">Terms</a>
            <a href="#" className="hover:text-gray-400 transition-colors">Privacy</a>
            <a href="#" className="hover:text-gray-400 transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
