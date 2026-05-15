'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { getToken, getUser } from '@/lib/auth';
import {
  Check, Zap, Crown, Star, ArrowRight, Shield, Code2, Trophy, Users,
  Sparkles, TrendingUp, Clock, Infinity,
} from 'lucide-react';

const PLANS = [
  {
    slug: 'free',
    name: 'Free',
    price: 0,
    priceLabel: '$0',
    period: 'forever',
    color: 'border-gray-700',
    badge: null,
    icon: Code2,
    iconColor: 'text-gray-400',
    features: [
      'Unlimited Easy challenges',
      '5 Medium challenges / day',
      'Basic code editor',
      'Community leaderboard',
      'Email support',
    ],
    disabled: ['AI hints', 'Priority support', 'Ad-free experience', 'Bonus rewards', 'Download solutions'],
  },
  {
    slug: 'pro',
    name: 'Pro',
    price: 9.99,
    priceLabel: '$9.99',
    period: 'per month',
    color: 'border-blue-500',
    badge: 'Most Popular',
    icon: Zap,
    iconColor: 'text-blue-400',
    features: [
      'Unlimited ALL challenges',
      'AI hints & explanations',
      'Priority email support',
      'Ad-free experience',
      'Reward multiplier ×1.5',
      'Download solutions',
      'Advanced analytics',
    ],
    disabled: ['Unlimited contests', '1-on-1 mentoring', 'Custom badges', 'Early access'],
  },
  {
    slug: 'elite',
    name: 'Elite',
    price: 29.99,
    priceLabel: '$29.99',
    period: 'per month',
    color: 'border-purple-500',
    badge: 'Best Value',
    icon: Crown,
    iconColor: 'text-purple-400',
    features: [
      'Everything in Pro',
      'Unlimited contests entry',
      '1-on-1 mentoring sessions',
      'Custom profile badges',
      'Reward multiplier ×2.0',
      'Early access to new features',
      'Dedicated account manager',
      'Certificate of achievement',
    ],
    disabled: [],
  },
];

const FEATURES_COMPARE = [
  { feature: 'Easy Challenges',        free: '∞',      pro: '∞',      elite: '∞' },
  { feature: 'Medium Challenges/day',  free: '5',       pro: '∞',      elite: '∞' },
  { feature: 'Hard Challenges/day',    free: '1',       pro: '∞',      elite: '∞' },
  { feature: 'AI Hints',               free: '✗',       pro: '✓',      elite: '✓' },
  { feature: 'Reward Multiplier',      free: '×1.0',    pro: '×1.5',   elite: '×2.0' },
  { feature: 'Contest Entry',          free: 'Limited', pro: 'Limited', elite: '∞' },
  { feature: 'Mentoring',              free: '✗',       pro: '✗',      elite: '✓' },
  { feature: 'Priority Support',       free: '✗',       pro: '✓',      elite: '✓' },
  { feature: 'Custom Badges',          free: '✗',       pro: '✗',      elite: '✓' },
  { feature: 'Ad-free',                free: '✗',       pro: '✓',      elite: '✓' },
];

export default function SubscriptionPage() {
  const router       = useRouter();
  const user         = getUser();
  const [billing,    setBilling]    = useState<'monthly' | 'annual'>('monthly');
  const [loading,    setLoading]    = useState<string | null>(null);
  const [msg,        setMsg]        = useState('');
  const currentPlan  = user?.subscription_plan || 'free';

  useEffect(() => { if (!getToken()) router.push('/auth/login'); }, []);

  const handleUpgrade = async (slug: string) => {
    if (slug === 'free' || slug === currentPlan) return;
    setLoading(slug);
    setMsg('');
    try {
      await api.post('/payments/subscribe', { plan: slug, billing });
      setMsg('Redirecting to payment...');
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Failed to initiate payment');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 space-y-12">

        {/* ── Header ── */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-purple-900/30 border border-purple-700/40 text-purple-300 text-xs font-semibold px-4 py-1.5 rounded-full">
            <Sparkles className="w-3.5 h-3.5" /> Upgrade Your Coding Journey
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white">
            Choose your <span className="text-gradient">plan</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Unlock unlimited challenges, AI-powered hints, higher reward multipliers, and more.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-full p-1">
            {(['monthly', 'annual'] as const).map(b => (
              <button key={b} onClick={() => setBilling(b)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  billing === b ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}>
                {b === 'annual' ? '🏷️ Annual (save 20%)' : 'Monthly'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Plans ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map(plan => {
            const price  = billing === 'annual' && plan.price > 0 ? plan.price * 0.8 : plan.price;
            const isCurrent = plan.slug === currentPlan;
            const Icon   = plan.icon;
            return (
              <div key={plan.slug}
                className={`relative card border-2 p-6 flex flex-col transition-all hover:scale-[1.02] ${plan.color} ${plan.slug === 'pro' ? 'shadow-blue-900/30 shadow-xl' : ''}`}>
                {plan.badge && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-black px-4 py-1 rounded-full ${plan.slug === 'pro' ? 'bg-blue-600' : 'bg-purple-600'} text-white`}>
                    {plan.badge}
                  </div>
                )}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${plan.slug === 'pro' ? 'bg-blue-900/40' : plan.slug === 'elite' ? 'bg-purple-900/40' : 'bg-gray-800'}`}>
                  <Icon className={`w-6 h-6 ${plan.iconColor}`} />
                </div>
                <h3 className="text-xl font-black text-white mb-1">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-black text-white">
                    {price === 0 ? 'Free' : `$${price.toFixed(2)}`}
                  </span>
                  {price > 0 && <span className="text-gray-500 text-sm ml-1">/{billing === 'annual' ? 'mo, billed annually' : 'month'}</span>}
                </div>

                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                  {plan.disabled.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600 line-through">
                      <span className="w-4 h-4 mt-0.5 shrink-0 text-center text-gray-700">✗</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(plan.slug)}
                  disabled={isCurrent || plan.slug === 'free' || loading === plan.slug}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                    isCurrent
                      ? 'bg-green-900/30 border border-green-700 text-green-400 cursor-default'
                      : plan.slug === 'free'
                      ? 'bg-gray-800 text-gray-500 cursor-default'
                      : plan.slug === 'elite'
                      ? 'bg-purple-600 hover:bg-purple-500 text-white'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}>
                  {loading === plan.slug ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : isCurrent ? (
                    <><Check className="w-4 h-4" /> Current Plan</>
                  ) : plan.slug === 'free' ? (
                    'Default'
                  ) : (
                    <>Upgrade to {plan.name} <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {msg && (
          <div className="text-center">
            <p className={`text-sm ${msg.includes('Redirect') ? 'text-blue-400' : 'text-red-400'}`}>{msg}</p>
          </div>
        )}

        {/* ── Comparison Table ── */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-lg font-bold text-white">Full Feature Comparison</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-6 py-3 text-gray-500 font-semibold">Feature</th>
                  {PLANS.map(p => (
                    <th key={p.slug} className={`px-4 py-3 font-bold text-center ${p.slug === currentPlan ? 'text-blue-400' : 'text-gray-400'}`}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {FEATURES_COMPARE.map(row => (
                  <tr key={row.feature} className="hover:bg-gray-900/30">
                    <td className="px-6 py-3 text-gray-300">{row.feature}</td>
                    {(['free', 'pro', 'elite'] as const).map(p => (
                      <td key={p} className={`px-4 py-3 text-center font-semibold ${
                        (row as any)[p] === '✓' ? 'text-green-400' :
                        (row as any)[p] === '✗' ? 'text-gray-700' :
                        'text-gray-300'
                      }`}>
                        {(row as any)[p]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Trust signals ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { icon: Shield, label: 'Secure Payments', sub: 'SSL encrypted' },
            { icon: TrendingUp, label: 'Instant Upgrade', sub: 'No waiting' },
            { icon: Clock, label: 'Cancel Anytime', sub: 'No lock-in' },
            { icon: Users, label: '50K+ Coders', sub: 'Already joined' },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="card p-4">
              <Icon className="w-6 h-6 text-blue-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-xs text-gray-500">{sub}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
