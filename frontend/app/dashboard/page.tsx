'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { getToken, getUser } from '@/lib/auth';
import { Code2, Trophy, Wallet, TrendingUp, CheckCircle, Clock } from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  const user   = getUser();
  const [stats,    setStats]    = useState<any>(null);
  const [contests, setContests] = useState<any[]>([]);
  const [recent,   setRecent]   = useState<any[]>([]);

  useEffect(() => { if (!getToken()) router.push('/auth/login'); }, []);

  useEffect(() => {
    Promise.all([
      api.get('/auth/me'),
      api.get('/contests?status=active'),
      api.get('/submissions'),
    ]).then(([me, c, s]) => {
      setStats(me.data);
      setContests((c.data || []).slice(0, 3));
      setRecent((s.data || []).slice(0, 5));
    }).catch(() => {});
  }, []);

  const DIFF_CLASS: Record<string, string> = {
    easy: 'diff-easy', medium: 'diff-medium', hard: 'diff-hard',
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">Ready to compete?</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Balance',         value: `${Number(stats?.balance || 0).toLocaleString()} RWF`, icon: Wallet,      color: 'text-green-400' },
            { label: 'Total Earnings',  value: `${Number(stats?.total_earnings || 0).toLocaleString()} RWF`, icon: TrendingUp, color: 'text-yellow-400' },
            { label: 'Problems Solved', value: stats?.solved || '—',    icon: CheckCircle, color: 'text-blue-400' },
            { label: 'Contests Joined', value: stats?.contests || '—',  icon: Trophy,      color: 'text-purple-400' },
          ].map(s => (
            <div key={s.label} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide">{s.label}</p>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Contests */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Active Contests</h2>
              <Link href="/contests" className="text-sm text-green-400 hover:text-green-300">View all →</Link>
            </div>
            {contests.length === 0 ? (
              <div className="card p-8 text-center text-gray-500">No active contests right now</div>
            ) : (
              <div className="space-y-3">
                {contests.map((c: any) => (
                  <Link key={c.id} href={`/contests/${c.id}`}
                    className="card p-4 flex items-center justify-between hover:border-green-800/50 transition-all group">
                    <div>
                      <p className="font-semibold text-white group-hover:text-green-300 transition-colors">{c.title}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {c.participant_count || 0} participants ·
                        {c.entry_fee > 0 ? ` ${Number(c.entry_fee).toLocaleString()} RWF entry` : ' Free'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-green-400 font-bold text-sm">{Number(c.prize_pool || 0).toLocaleString()} RWF</p>
                      <p className="text-xs text-gray-500">prize pool</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent Submissions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Recent Submissions</h2>
              <Link href="/challenges" className="text-sm text-green-400 hover:text-green-300">Practice →</Link>
            </div>
            {recent.length === 0 ? (
              <div className="card p-8 text-center text-gray-500">
                <Code2 className="w-8 h-8 mx-auto mb-2 text-gray-700" />
                <p>No submissions yet</p>
                <Link href="/challenges" className="btn-primary mt-4 inline-flex">Start Solving</Link>
              </div>
            ) : (
              <div className="card overflow-hidden divide-y divide-gray-800">
                {recent.map((s: any) => (
                  <div key={s.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{s.challenge_title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 capitalize">{s.language} · {new Date(s.submitted_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`badge text-xs ${
                      s.status === 'accepted' ? 'badge-green' :
                      s.status === 'wrong_answer' ? 'badge-red' : 'badge-yellow'
                    }`}>
                      {s.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { href: '/challenges', label: 'Practice Challenges', desc: 'Sharpen your skills', icon: '🧩', color: 'border-blue-800/30 hover:border-blue-700/50' },
            { href: '/contests',   label: 'Join a Contest',      desc: 'Win real money',   icon: '🏆', color: 'border-yellow-800/30 hover:border-yellow-700/50' },
            { href: '/wallet',     label: 'Wallet & Payments',   desc: 'Deposit · Withdraw', icon: '💰', color: 'border-green-800/30 hover:border-green-700/50' },
          ].map(a => (
            <Link key={a.href} href={a.href}
              className={`card p-5 flex items-center gap-4 transition-all group ${a.color}`}>
              <span className="text-3xl">{a.icon}</span>
              <div>
                <p className="font-semibold text-white group-hover:text-green-300 transition-colors">{a.label}</p>
                <p className="text-gray-500 text-xs">{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
