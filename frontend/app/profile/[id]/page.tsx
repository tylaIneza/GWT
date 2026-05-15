'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { getToken, getUser } from '@/lib/auth';
import {
  Trophy, Code2, Flame, Award, Star, Zap, Globe, Github, Twitter, ExternalLink,
  Calendar, TrendingUp, Target, CheckCircle, Wallet, Settings, ArrowRight,
  BarChart2, Shield, Crown, Edit3,
} from 'lucide-react';

const DIFF_COLOR: Record<string, string> = {
  easy:   'text-green-400 bg-green-900/30 border-green-800/40',
  medium: 'text-yellow-400 bg-yellow-900/30 border-yellow-800/40',
  hard:   'text-red-400 bg-red-900/30 border-red-800/40',
};

const RARITY_STYLE: Record<string, { ring: string; glow: string; label: string }> = {
  common:    { ring: 'border-gray-600',    glow: '',                          label: 'text-gray-500' },
  uncommon:  { ring: 'border-green-500',   glow: 'shadow-green-500/20',       label: 'text-green-500' },
  rare:      { ring: 'border-blue-500',    glow: 'shadow-blue-500/20',        label: 'text-blue-400' },
  legendary: { ring: 'border-yellow-500',  glow: 'shadow-yellow-500/30',      label: 'text-yellow-400' },
};

const PLAN_STYLE: Record<string, { label: string; badge: string }> = {
  free:  { label: 'Free',  badge: 'bg-gray-800 text-gray-400 border-gray-700' },
  pro:   { label: 'Pro',   badge: 'bg-blue-900/40 text-blue-300 border-blue-800/40' },
  elite: { label: 'Elite', badge: 'bg-purple-900/40 text-purple-300 border-purple-800/40' },
};

function StatPill({ icon: Icon, value, label, color }: any) {
  return (
    <div className="flex flex-col items-center gap-1 px-5 py-4 bg-gray-900/60 rounded-2xl border border-gray-800/60 min-w-[90px]">
      <Icon className={`w-5 h-5 ${color} mb-0.5`} />
      <p className={`text-xl font-black ${color}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 30) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

export default function ProfilePage() {
  const { id }    = useParams<{ id: string }>();
  const router    = useRouter();
  const me        = getUser();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rank,    setRank]    = useState<number | null>(null);
  const [tab,     setTab]     = useState<'solves' | 'badges'>('solves');

  useEffect(() => { if (!getToken()) router.push('/auth/login'); }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      api.get(`/challenges/profile/${id}`),
      api.get('/leaderboard/my-rank').catch(() => ({ data: null })),
    ])
      .then(([p, r]) => {
        setProfile(p.data);
        if (String(id) === String(me?.id)) setRank(r.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-10 space-y-5 animate-pulse">
          <div className="h-48 bg-gray-800/50 rounded-2xl" />
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-800/50 rounded-2xl" />)}
          </div>
          <div className="h-64 bg-gray-800/50 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center flex-col gap-4">
          <Shield className="w-16 h-16 text-gray-700" />
          <p className="text-gray-400 text-lg font-semibold">User not found</p>
          <p className="text-gray-600 text-sm">This profile doesn't exist or is private.</p>
          <Link href="/leaderboard" className="mt-2 text-green-400 hover:text-green-300 flex items-center gap-1.5 text-sm font-semibold">
            View Leaderboard <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  const plan  = PLAN_STYLE[profile.subscription_plan || 'free'];
  const isMe  = String(id) === String(me?.id);
  const total = profile.solved_count || 0;
  const easy  = profile.stats?.easy_solved   || 0;
  const med   = profile.stats?.medium_solved || 0;
  const hard  = profile.stats?.hard_solved   || 0;

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />

      {/* ── Profile Banner ── */}
      <div className="relative h-36 bg-gradient-to-r from-blue-900/40 via-purple-900/30 to-emerald-900/20 border-b border-gray-800 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'linear-gradient(#6366f1 1px,transparent 1px),linear-gradient(90deg,#6366f1 1px,transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-purple-500/8 rounded-full blur-3xl" />
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pb-12">

        {/* ── Profile Header ── */}
        <div className="relative -mt-14 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row gap-5 items-start">

              {/* Avatar */}
              <div className="relative -mt-14 sm:-mt-16 shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-4 border-gray-900 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-4xl font-black text-white shadow-xl overflow-hidden">
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                    : (profile.name || '?').charAt(0).toUpperCase()
                  }
                </div>
                {profile.current_streak > 0 && (
                  <div className="absolute -bottom-2 -right-2 bg-orange-500 border-2 border-gray-900 text-white text-xs font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow">
                    <Flame className="w-3 h-3" /> {profile.current_streak}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 sm:pt-0 pt-2">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-2xl font-black text-white">{profile.name}</h1>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${plan.badge}`}>
                    {plan.label}
                  </span>
                  {rank !== null && isMe && (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-yellow-900/30 text-yellow-400 border border-yellow-800/40 flex items-center gap-1">
                      <Crown className="w-3 h-3" /> Rank #{rank}
                    </span>
                  )}
                </div>

                {profile.bio && (
                  <p className="text-gray-400 text-sm mb-3 leading-relaxed">{profile.bio}</p>
                )}

                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                  {profile.country_code && (
                    <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> {profile.country_code}</span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Joined {new Date(profile.created_at).toLocaleDateString('en', { month: 'long', year: 'numeric' })}
                  </span>
                  {profile.github_url && (
                    <a href={profile.github_url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 hover:text-white transition-colors">
                      <Github className="w-3.5 h-3.5" /> GitHub
                    </a>
                  )}
                  {profile.twitter_url && (
                    <a href={profile.twitter_url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 hover:text-white transition-colors">
                      <Twitter className="w-3.5 h-3.5" /> Twitter
                    </a>
                  )}
                  {profile.website_url && (
                    <a href={profile.website_url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 hover:text-white transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" /> Website
                    </a>
                  )}
                </div>
              </div>

              {isMe && (
                <button onClick={() => router.push('/settings')}
                  className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 text-sm font-semibold px-4 py-2 rounded-xl transition-all shrink-0">
                  <Edit3 className="w-3.5 h-3.5" /> Edit Profile
                </button>
              )}
            </div>

            {/* Quick stats row */}
            <div className="flex flex-wrap gap-3 mt-5 pt-5 border-t border-gray-800">
              <StatPill icon={Code2}     value={total}  label="Solved"      color="text-blue-400" />
              <StatPill icon={Wallet}    value={`$${Number(profile.total_earnings || 0).toFixed(0)}`} label="Earned" color="text-green-400" />
              <StatPill icon={Flame}     value={`${profile.current_streak || 0}d`} label="Streak" color="text-orange-400" />
              <StatPill icon={Trophy}    value={`${profile.longest_streak || 0}d`} label="Best Streak" color="text-yellow-400" />
              {profile.badges?.length > 0 && (
                <StatPill icon={Award}   value={profile.badges.length} label="Badges" color="text-purple-400" />
              )}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-5">

          {/* Left — Main content */}
          <div className="lg:col-span-2 space-y-5">

            {/* Difficulty Breakdown */}
            {total > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-5 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-green-400" /> Problem Difficulty
                </h2>
                <div className="grid grid-cols-3 gap-5 mb-5">
                  {[
                    { label: 'Easy',   count: easy, color: 'text-green-400', bar: 'bg-green-500', ring: 'border-green-500/30 bg-green-500/10' },
                    { label: 'Medium', count: med,  color: 'text-yellow-400', bar: 'bg-yellow-500', ring: 'border-yellow-500/30 bg-yellow-500/10' },
                    { label: 'Hard',   count: hard, color: 'text-red-400', bar: 'bg-red-500', ring: 'border-red-500/30 bg-red-500/10' },
                  ].map(d => (
                    <div key={d.label} className={`rounded-xl border p-4 text-center ${d.ring}`}>
                      <p className={`text-2xl font-black ${d.color}`}>{d.count}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{d.label}</p>
                    </div>
                  ))}
                </div>
                {/* Progress bars */}
                <div className="space-y-2.5">
                  {[
                    { label: 'Easy',   count: easy, total: 50, color: 'bg-green-500' },
                    { label: 'Medium', count: med,  total: 50, color: 'bg-yellow-500' },
                    { label: 'Hard',   count: hard, total: 50, color: 'bg-red-500' },
                  ].map(d => (
                    <div key={d.label} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-12">{d.label}</span>
                      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-2 rounded-full ${d.color} transition-all duration-700`}
                          style={{ width: `${Math.min((d.count / d.total) * 100, 100)}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-10 text-right">{d.count}/{d.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs */}
            {(profile.recent_solves?.length > 0 || profile.badges?.length > 0) && (
              <div>
                <div className="flex gap-1 mb-4 bg-gray-900 border border-gray-800 rounded-xl p-1">
                  <button onClick={() => setTab('solves')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'solves' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                    <CheckCircle className="w-3.5 h-3.5" /> Recent Solves
                    {profile.recent_solves?.length > 0 && <span className="text-xs bg-gray-700 text-gray-400 rounded-full px-1.5">{profile.recent_solves.length}</span>}
                  </button>
                  <button onClick={() => setTab('badges')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'badges' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                    <Award className="w-3.5 h-3.5" /> Badges
                    {profile.badges?.length > 0 && <span className="text-xs bg-gray-700 text-gray-400 rounded-full px-1.5">{profile.badges.length}</span>}
                  </button>
                </div>

                {/* Recent Solves Tab */}
                {tab === 'solves' && (
                  profile.recent_solves?.length > 0 ? (
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                      {profile.recent_solves.map((s: any, i: number) => (
                        <div key={i} className={`px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-gray-800/30 transition-colors ${i < profile.recent_solves.length - 1 ? 'border-b border-gray-800/60' : ''}`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-green-900/30 border border-green-800/30 flex items-center justify-center shrink-0">
                              <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{s.title}</p>
                              <p className="text-xs text-gray-500">{s.category || 'Algorithm'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {s.difficulty && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border capitalize ${DIFF_COLOR[s.difficulty] || 'text-gray-400 border-gray-700'}`}>
                                {s.difficulty}
                              </span>
                            )}
                            <span className="text-xs text-gray-600 hidden sm:block">{timeAgo(s.submitted_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
                      <Code2 className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No solves yet</p>
                      {isMe && (
                        <Link href="/challenges" className="inline-flex items-center gap-1.5 text-green-400 hover:text-green-300 text-sm font-semibold mt-3 transition-colors">
                          Start solving <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  )
                )}

                {/* Badges Tab */}
                {tab === 'badges' && (
                  profile.badges?.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {profile.badges.map((badge: any) => {
                        const r = RARITY_STYLE[badge.rarity] || RARITY_STYLE.common;
                        return (
                          <div key={badge.slug} title={badge.description}
                            className={`bg-gray-900 border-2 ${r.ring} rounded-2xl p-4 text-center hover:scale-105 transition-all duration-200 cursor-default shadow-lg ${r.glow}`}>
                            <div className="text-3xl mb-2">{badge.icon}</div>
                            <p className="text-xs text-white font-bold leading-tight">{badge.name}</p>
                            <p className={`text-xs capitalize mt-1 font-semibold ${r.label}`}>{badge.rarity}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
                      <Award className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No badges yet</p>
                      {isMe && (
                        <Link href="/challenges" className="inline-flex items-center gap-1.5 text-green-400 hover:text-green-300 text-sm font-semibold mt-3 transition-colors">
                          Earn your first badge <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  )
                )}
              </div>
            )}

            {/* Empty state */}
            {!profile.badges?.length && !profile.recent_solves?.length && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-14 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-4">
                  <Star className="w-8 h-8 text-gray-600" />
                </div>
                <p className="text-white font-bold mb-2">No activity yet</p>
                <p className="text-gray-500 text-sm mb-5">Start solving challenges to earn badges and climb the leaderboard!</p>
                {isMe && (
                  <Link href="/challenges"
                    className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold px-6 py-2.5 rounded-xl transition-all">
                    Browse Challenges <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">

            {/* Rank card */}
            {rank !== null && isMe && (
              <div className="bg-gradient-to-br from-yellow-900/20 to-transparent border border-yellow-800/30 rounded-2xl p-5 text-center">
                <Crown className="w-7 h-7 text-yellow-400 mx-auto mb-2" />
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-1">Global Rank</p>
                <p className="text-4xl font-black text-yellow-400">#{rank}</p>
                <Link href="/leaderboard" className="mt-3 inline-flex items-center gap-1 text-xs text-yellow-500 hover:text-yellow-300 transition-colors font-semibold">
                  Full leaderboard <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}

            {/* Subscription badge */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  profile.subscription_plan === 'elite' ? 'bg-purple-900/40' :
                  profile.subscription_plan === 'pro'   ? 'bg-blue-900/40' : 'bg-gray-800'
                }`}>
                  {profile.subscription_plan === 'elite' ? <Crown className="w-4 h-4 text-purple-400" /> :
                   profile.subscription_plan === 'pro'   ? <Zap className="w-4 h-4 text-blue-400" /> :
                   <Star className="w-4 h-4 text-gray-500" />}
                </div>
                <div>
                  <p className="text-xs text-gray-500">Subscription</p>
                  <p className={`text-sm font-bold ${
                    profile.subscription_plan === 'elite' ? 'text-purple-300' :
                    profile.subscription_plan === 'pro'   ? 'text-blue-300' : 'text-gray-300'
                  }`}>{plan.label} Plan</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {profile.subscription_plan === 'elite' ? '2× reward multiplier active' :
                 profile.subscription_plan === 'pro'   ? '1.5× reward multiplier active' :
                 'No multiplier — upgrade for bonus rewards'}
              </p>
              {isMe && (!profile.subscription_plan || profile.subscription_plan === 'free') && (
                <Link href="/subscription" className="block mt-3 text-center text-xs font-bold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white py-2 rounded-lg transition-all">
                  Upgrade Now
                </Link>
              )}
            </div>

            {/* Languages used */}
            {profile.recent_solves?.length > 0 && (() => {
              const langs: Record<string, number> = {};
              profile.recent_solves.forEach((s: any) => { if (s.language) langs[s.language] = (langs[s.language] || 0) + 1; });
              const sorted = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 4);
              if (!sorted.length) return null;
              return (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Code2 className="w-3.5 h-3.5" /> Top Languages
                  </h3>
                  <div className="space-y-2.5">
                    {sorted.map(([lang, count]) => (
                      <div key={lang} className="flex items-center gap-2">
                        <span className="text-xs text-gray-300 font-mono capitalize w-20 truncate">{lang}</span>
                        <div className="flex-1 h-1.5 bg-gray-800 rounded-full">
                          <div className="h-1.5 rounded-full bg-green-500 transition-all duration-500"
                            style={{ width: `${(count / profile.recent_solves.length) * 100}%` }} />
                        </div>
                        <span className="text-xs text-gray-600">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Action button for own profile */}
            {isMe && (
              <Link href="/challenges"
                className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-all hover:-translate-y-0.5 text-sm">
                <Code2 className="w-4 h-4" /> Solve More Challenges
              </Link>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
