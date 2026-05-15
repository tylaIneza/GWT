'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { getToken, getUser, isAdmin } from '@/lib/auth';
import {
  Code2, Trophy, Wallet, TrendingUp, CheckCircle, Flame,
  ArrowRight, Zap, Star, Clock, Award, Target, ChevronRight,
  BarChart2, PlayCircle, Plus,
} from 'lucide-react';

const QUICK_ACTIONS = [
  { href: '/challenges',  icon: Code2,     label: 'Solve a Challenge', desc: 'Sharpen your skills',     color: 'from-blue-500/15 to-blue-600/5',   border: 'border-blue-800/30 hover:border-blue-600/50',   iconColor: 'text-blue-400',   iconBg: 'bg-blue-900/40' },
  { href: '/contests',    icon: Trophy,    label: 'Join a Contest',    desc: 'Win real money prizes',   color: 'from-yellow-500/15 to-yellow-600/5', border: 'border-yellow-800/30 hover:border-yellow-600/50', iconColor: 'text-yellow-400', iconBg: 'bg-yellow-900/40' },
  { href: '/wallet',      icon: Wallet,    label: 'Manage Wallet',     desc: 'Deposit or withdraw',     color: 'from-green-500/15 to-green-600/5',  border: 'border-green-800/30 hover:border-green-600/50',  iconColor: 'text-green-400',  iconBg: 'bg-green-900/40' },
  { href: '/leaderboard', icon: BarChart2, label: 'Leaderboard',       desc: 'See your global rank',    color: 'from-purple-500/15 to-purple-600/5', border: 'border-purple-800/30 hover:border-purple-600/50', iconColor: 'text-purple-400', iconBg: 'bg-purple-900/40' },
];

const STATUS_STYLE: Record<string, { label: string; badge: string }> = {
  accepted:     { label: 'Accepted',     badge: 'bg-green-900/40 text-green-400 border border-green-800/50' },
  wrong_answer: { label: 'Wrong Answer', badge: 'bg-red-900/40 text-red-400 border border-red-800/50' },
  time_limit:   { label: 'Time Limit',   badge: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800/50' },
  error:        { label: 'Error',        badge: 'bg-orange-900/40 text-orange-400 border border-orange-800/50' },
};

const DIFF_COLOR: Record<string, string> = {
  easy:   'text-green-400 bg-green-900/30',
  medium: 'text-yellow-400 bg-yellow-900/30',
  hard:   'text-red-400 bg-red-900/30',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function StatCard({ icon: Icon, label, value, color, bg, sub }: any) {
  return (
    <div className={`relative bg-gradient-to-br ${bg} border border-gray-800/80 rounded-2xl p-5 overflow-hidden group hover:-translate-y-0.5 transition-all duration-200`}>
      <div className="absolute top-3 right-3">
        <Icon className={`w-5 h-5 ${color} opacity-60`} />
      </div>
      <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const user   = getUser();
  const [stats,    setStats]    = useState<any>(null);
  const [contests, setContests] = useState<any[]>([]);
  const [recent,   setRecent]   = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!getToken()) { router.push('/auth/login'); return; }
    if (isAdmin())   { router.push('/admin');      return; }
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/auth/me'),
      api.get('/contests?status=active'),
      api.get('/submissions'),
    ]).then(([me, c, s]) => {
      setStats(me.data);
      setContests((c.data || []).slice(0, 3));
      setRecent((s.data || []).slice(0, 6));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const firstName = user?.name?.split(' ')[0] || 'Coder';
  const balance   = Number(stats?.balance || 0);
  const earnings  = Number(stats?.total_earnings || 0);
  const solved    = stats?.solved_count ?? stats?.solved ?? 0;
  const streak    = stats?.current_streak || 0;

  const getHour = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-28 bg-gray-800/50 rounded-2xl" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-800/50 rounded-2xl" />)}
            </div>
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="h-64 bg-gray-800/50 rounded-2xl" />
              <div className="h-64 bg-gray-800/50 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-7">

        {/* ── Welcome Banner ── */}
        <div className="relative bg-gradient-to-r from-green-900/25 via-emerald-900/15 to-transparent border border-green-800/30 rounded-2xl p-6 overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(#22c55e 1px,transparent 1px),linear-gradient(90deg,#22c55e 1px,transparent 1px)', backgroundSize: '32px 32px' }} />
          <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden sm:block opacity-10">
            <Code2 className="w-24 h-24 text-green-400" />
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-lg font-black text-white shadow-lg">
                  {firstName.charAt(0)}
                </div>
                <div>
                  <p className="text-gray-400 text-sm">{getHour()},</p>
                  <h1 className="text-xl font-black text-white">{firstName} 👋</h1>
                </div>
              </div>
              <p className="text-gray-500 text-sm mt-2 ml-0.5">Ready to solve challenges and earn today?</p>
              {streak > 0 && (
                <div className="inline-flex items-center gap-1.5 mt-3 bg-orange-900/20 border border-orange-800/40 text-orange-400 rounded-full px-3 py-1 text-xs font-semibold">
                  <Flame className="w-3.5 h-3.5" /> {streak}-day streak — keep it going!
                </div>
              )}
            </div>
            <Link href="/challenges"
              className="hidden sm:flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold px-5 py-2.5 rounded-xl transition-all hover:-translate-y-0.5 shadow-lg shadow-green-900/30 text-sm">
              <PlayCircle className="w-4 h-4" /> Start Solving
            </Link>
          </div>
        </div>

        {/* ── Stats Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            icon={Wallet} label="Balance" color="text-green-400"
            bg="from-green-900/15 to-transparent"
            value={`$${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            sub="Available to withdraw"
          />
          <StatCard
            icon={TrendingUp} label="Total Earnings" color="text-yellow-400"
            bg="from-yellow-900/15 to-transparent"
            value={`$${earnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            sub="All time"
          />
          <StatCard
            icon={CheckCircle} label="Problems Solved" color="text-blue-400"
            bg="from-blue-900/15 to-transparent"
            value={solved || '0'}
            sub={solved > 0 ? `${stats?.stats?.easy_solved || 0}E · ${stats?.stats?.medium_solved || 0}M · ${stats?.stats?.hard_solved || 0}H` : 'Start solving!'}
          />
          <StatCard
            icon={Trophy} label="Contests Joined" color="text-purple-400"
            bg="from-purple-900/15 to-transparent"
            value={stats?.contests || '0'}
            sub="Total competitions"
          />
        </div>

        {/* ── Main Content Grid ── */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Active Contests — takes 2 cols */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-400" /> Active Contests
              </h2>
              <Link href="/contests" className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1 transition-colors">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {contests.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
                <Trophy className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm mb-4">No active contests right now</p>
                <Link href="/contests" className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all">
                  <Plus className="w-3.5 h-3.5" /> Browse Contests
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {contests.map((c: any) => (
                  <Link key={c.id} href={`/contests/${c.id}`}
                    className="block bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-green-800/60 transition-all group hover:-translate-y-0.5 duration-200">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                          <span className="text-xs text-green-400 font-semibold uppercase tracking-wider">Live</span>
                        </div>
                        <p className="font-bold text-white group-hover:text-green-300 transition-colors truncate">{c.title}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                          <span>{c.participant_count || 0} participants</span>
                          <span>·</span>
                          <span>{c.entry_fee > 0 ? `$${Number(c.entry_fee).toLocaleString()} entry` : 'Free'}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-green-400 font-black">${Number(c.prize_pool || 0).toLocaleString()}</p>
                        <p className="text-xs text-gray-500">prize pool</p>
                        <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-green-400 ml-auto mt-2 transition-colors" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Recent Submissions */}
            <div className="flex items-center justify-between mt-6 mb-4">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Code2 className="w-4 h-4 text-blue-400" /> Recent Submissions
              </h2>
              <Link href="/challenges" className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1 transition-colors">
                Practice <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recent.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
                <Code2 className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm mb-4">No submissions yet — start solving challenges!</p>
                <Link href="/challenges" className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all">
                  Browse Challenges
                </Link>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                {recent.map((s: any, i: number) => {
                  const st = STATUS_STYLE[s.status] || { label: s.status, badge: 'bg-gray-800 text-gray-400 border border-gray-700' };
                  return (
                    <div key={s.id} className={`px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-gray-800/30 transition-colors ${i < recent.length - 1 ? 'border-b border-gray-800/60' : ''}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${s.status === 'accepted' ? 'bg-green-400' : s.status === 'wrong_answer' ? 'bg-red-400' : 'bg-yellow-400'}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{s.challenge_title || 'Challenge'}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500 capitalize font-mono">{s.language}</span>
                            {s.difficulty && (
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize ${DIFF_COLOR[s.difficulty] || 'text-gray-400'}`}>
                                {s.difficulty}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${st.badge}`}>{st.label}</span>
                        <span className="text-xs text-gray-600 hidden sm:block">{timeAgo(s.submitted_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-5">

            {/* Progress Card */}
            {solved > 0 && stats?.stats && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4 text-green-400" /> Difficulty Breakdown
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'Easy',   count: stats.stats.easy_solved   || 0, total: 50, color: 'bg-green-500',  text: 'text-green-400' },
                    { label: 'Medium', count: stats.stats.medium_solved || 0, total: 50, color: 'bg-yellow-500', text: 'text-yellow-400' },
                    { label: 'Hard',   count: stats.stats.hard_solved   || 0, total: 50, color: 'bg-red-500',    text: 'text-red-400' },
                  ].map(d => (
                    <div key={d.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-gray-400">{d.label}</span>
                        <span className={`text-xs font-bold ${d.text}`}>{d.count}/{d.total}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-800">
                        <div className={`h-1.5 rounded-full ${d.color} transition-all duration-700`}
                          style={{ width: `${Math.min((d.count / d.total) * 100, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between">
                  <span className="text-xs text-gray-500">Total solved</span>
                  <span className="text-sm font-black text-white">{solved} / 150</span>
                </div>
              </div>
            )}

            {/* Streak Card */}
            <div className="bg-gradient-to-br from-orange-900/20 to-transparent border border-orange-800/30 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-orange-900/40 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Daily Streak</p>
                  <p className="text-2xl font-black text-orange-400">{streak}<span className="text-base font-semibold text-gray-500"> days</span></p>
                </div>
              </div>
              {streak === 0 ? (
                <p className="text-xs text-gray-500">Solve a challenge today to start your streak!</p>
              ) : (
                <p className="text-xs text-gray-500">Keep going! Best streak: <span className="text-orange-400 font-semibold">{stats?.longest_streak || streak}d</span></p>
              )}
            </div>

            {/* Subscription */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-bold text-white">Plan</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  stats?.subscription_plan === 'elite' ? 'bg-purple-900/40 text-purple-400 border border-purple-800/40' :
                  stats?.subscription_plan === 'pro'   ? 'bg-blue-900/40 text-blue-400 border border-blue-800/40' :
                  'bg-gray-800 text-gray-400 border border-gray-700'
                }`}>
                  {(stats?.subscription_plan || 'free').charAt(0).toUpperCase() + (stats?.subscription_plan || 'free').slice(1)}
                </span>
              </div>
              {(!stats?.subscription_plan || stats?.subscription_plan === 'free') && (
                <>
                  <p className="text-xs text-gray-500 mb-3">Upgrade to Pro for 1.5× reward multiplier on all solutions.</p>
                  <Link href="/subscription" className="block text-center text-xs font-bold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white py-2.5 rounded-xl transition-all">
                    Upgrade Plan
                  </Link>
                </>
              )}
              {stats?.subscription_plan === 'pro' && (
                <p className="text-xs text-gray-500">You're earning 1.5× on all solutions. <Link href="/subscription" className="text-purple-400">Go Elite →</Link></p>
              )}
              {stats?.subscription_plan === 'elite' && (
                <p className="text-xs text-gray-500">You're on Elite — earning 2× rewards on all solutions. 🎉</p>
              )}
            </div>

          </div>
        </div>

        {/* ── Quick Actions ── */}
        <div>
          <h2 className="font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-green-400" /> Quick Actions
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {QUICK_ACTIONS.map(a => (
              <Link key={a.href} href={a.href}
                className={`bg-gradient-to-br ${a.color} border ${a.border} rounded-2xl p-4 flex items-center gap-3 transition-all group hover:-translate-y-0.5 duration-200`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${a.iconBg}`}>
                  <a.icon className={`w-4 h-4 ${a.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white group-hover:text-green-300 transition-colors leading-tight">{a.label}</p>
                  <p className="text-xs text-gray-500 truncate">{a.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
