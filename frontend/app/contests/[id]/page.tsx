'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { getToken, getUser } from '@/lib/auth';
import { Trophy, Clock, Users, Code2, AlertCircle } from 'lucide-react';

function Countdown({ end }: { end: string }) {
  const [left, setLeft] = useState('');
  useEffect(() => {
    const tick = () => {
      const ms = new Date(end).getTime() - Date.now();
      if (ms <= 0) { setLeft('Contest ended'); return; }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setLeft(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [end]);
  return <span className="font-mono text-2xl font-black text-amber-400">{left}</span>;
}

const MEDAL = ['🥇', '🥈', '🥉'];

export default function ContestDetailPage() {
  const router    = useRouter();
  const { id }    = useParams<{ id: string }>();
  const user      = getUser();
  const [contest,      setContest]      = useState<any>(null);
  const [leaderboard,  setLeaderboard]  = useState<any[]>([]);
  const [joining,      setJoining]      = useState(false);
  const [msg,          setMsg]          = useState('');
  const [tab,          setTab]          = useState<'overview'|'leaderboard'|'problems'>('overview');

  useEffect(() => { if (!getToken()) router.push('/auth/login'); }, []);

  const load = () => {
    api.get(`/contests/${id}`, { params: { userId: user?.id } })
      .then(r => setContest(r.data))
      .catch(() => router.push('/contests'));
    api.get(`/contests/${id}/leaderboard`).then(r => setLeaderboard(r.data || [])).catch(() => {});
  };

  useEffect(() => { if (id) load(); }, [id]);

  const join = async () => {
    setJoining(true); setMsg('');
    try {
      await api.post(`/contests/${id}/join`);
      setMsg('Successfully joined! 🎉');
      load();
    } catch (e: any) {
      setMsg(e.response?.data?.message || e.response?.data?.error || 'Failed to join');
    } finally { setJoining(false); }
  };

  if (!contest) return (
    <div className="min-h-screen bg-gray-950"><Navbar />
      <div className="flex items-center justify-center h-64 text-gray-500 animate-pulse">Loading...</div>
    </div>
  );

  const isActive = contest.status === 'active';
  const dist: any[] = contest.prize_distribution || [];

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="card p-6 bg-gradient-to-br from-green-900/10 to-gray-900">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`badge text-xs capitalize ${isActive ? 'badge-green' : 'badge'}`}>{contest.status}</span>
                {contest.is_rated && <span className="badge text-xs">Rated</span>}
              </div>
              <h1 className="text-2xl font-black text-white">{contest.title}</h1>
              {contest.description && <p className="text-gray-400 text-sm mt-2">{contest.description}</p>}
            </div>
            <div className="text-center shrink-0">
              <p className="text-3xl font-black text-green-400">{Number(contest.prize_pool || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-500">RWF total prize</p>
            </div>
          </div>

          {/* Timer */}
          {isActive && (
            <div className="mt-4 p-4 bg-amber-900/20 border border-amber-800/30 rounded-xl text-center">
              <p className="text-xs text-amber-500 uppercase font-semibold mb-1 flex items-center justify-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Time Remaining
              </p>
              <Countdown end={contest.end_time} />
            </div>
          )}

          {/* Meta */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="bg-gray-800 rounded-xl px-3 py-2.5">
              <p className="text-xs text-gray-500 mb-0.5">Entry Fee</p>
              <p className="font-bold text-white">{Number(contest.entry_fee) === 0 ? 'Free' : `${Number(contest.entry_fee).toLocaleString()} RWF`}</p>
            </div>
            <div className="bg-gray-800 rounded-xl px-3 py-2.5">
              <p className="text-xs text-gray-500 mb-0.5 flex items-center gap-1"><Users className="w-3 h-3" />Participants</p>
              <p className="font-bold text-white">{contest.participant_count || 0}{contest.max_participants ? `/${contest.max_participants}` : ''}</p>
            </div>
            <div className="bg-gray-800 rounded-xl px-3 py-2.5">
              <p className="text-xs text-gray-500 mb-0.5">Start</p>
              <p className="font-bold text-white text-sm">{new Date(contest.start_time).toLocaleString()}</p>
            </div>
            <div className="bg-gray-800 rounded-xl px-3 py-2.5">
              <p className="text-xs text-gray-500 mb-0.5">End</p>
              <p className="font-bold text-white text-sm">{new Date(contest.end_time).toLocaleString()}</p>
            </div>
          </div>

          {/* Join */}
          {msg && (
            <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium border ${msg.includes('🎉') ? 'bg-green-900/30 border-green-700 text-green-300' : 'bg-red-900/20 border-red-800 text-red-400'}`}>
              {msg}
            </div>
          )}
          {!contest.is_joined && (contest.status === 'upcoming' || isActive) && (
            <button onClick={join} disabled={joining}
              className="btn-primary mt-4 w-full justify-center py-3">
              {joining ? 'Joining...' : `⚔️ Join Contest${Number(contest.entry_fee) > 0 ? ` — ${Number(contest.entry_fee).toLocaleString()} RWF` : ' (Free)'}`}
            </button>
          )}
          {contest.is_joined && isActive && (
            <div className="mt-4 bg-green-900/20 border border-green-800 text-green-300 rounded-xl px-4 py-3 text-sm font-medium text-center">
              ✓ You&apos;re registered · Go to Problems tab to start coding
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-gray-800">
          {[
            { key: 'overview',     label: 'Overview'    },
            { key: 'problems',     label: `Problems (${contest.challenges?.length || 0})` },
            { key: 'leaderboard',  label: 'Leaderboard' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`pb-3 mr-6 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-green-500 text-green-400' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <div className="space-y-5">
            {/* Prize distribution */}
            {dist.length > 0 && (
              <div className="card p-5">
                <h2 className="font-bold text-white mb-4">Prize Distribution</h2>
                <div className="space-y-2">
                  {dist.map((d: any) => (
                    <div key={d.rank} className="flex items-center justify-between p-3 bg-gray-800 rounded-xl">
                      <span className="font-semibold text-white">
                        {MEDAL[d.rank - 1] || `#${d.rank}`} Place
                      </span>
                      <div className="text-right">
                        <span className="text-green-400 font-bold">
                          {((Number(contest.prize_pool) * d.percentage) / 100).toLocaleString()} RWF
                        </span>
                        <span className="text-gray-500 text-xs ml-2">({d.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card p-5 bg-amber-900/10 border-amber-800/20">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-200/70 space-y-1">
                  <p className="font-semibold text-amber-300">How ranking works</p>
                  <p>Participants are ranked by <strong>score first</strong>, then by <strong>total time taken</strong> — solving faster gives you an edge when scores are tied. Behavior is monitored for fair play.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Problems */}
        {tab === 'problems' && (
          <div className="space-y-3">
            {!contest.is_joined && (
              <div className="card p-6 text-center text-gray-500">
                <p>Join the contest to access problems</p>
              </div>
            )}
            {contest.is_joined && contest.challenges?.map((c: any, i: number) => (
              <Link key={c.id} href={`/challenges/${c.id}?contest=${id}`}
                className="card p-4 flex items-center gap-4 hover:border-green-800/50 transition-all group">
                <span className="text-gray-600 text-sm w-5 shrink-0">{i + 1}</span>
                <Code2 className="w-4 h-4 text-gray-600 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-white group-hover:text-green-300 transition-colors">{c.title}</p>
                </div>
                <span className={`badge text-xs capitalize ${c.difficulty === 'easy' ? 'diff-easy' : c.difficulty === 'medium' ? 'diff-medium' : 'diff-hard'}`}>
                  {c.difficulty}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* Leaderboard */}
        {tab === 'leaderboard' && (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <h2 className="font-semibold text-white text-sm">Live Leaderboard</h2>
            </div>
            {leaderboard.length === 0 ? (
              <div className="p-10 text-center text-gray-500">No scores yet</div>
            ) : (
              <div className="divide-y divide-gray-800">
                {leaderboard.map((p: any) => (
                  <div key={p.user_id} className={`px-4 py-3 flex items-center gap-3 ${p.user_id === user?.id ? 'bg-green-900/10' : ''}`}>
                    <span className="w-7 text-center text-lg shrink-0">
                      {MEDAL[p.rank - 1] || <span className="text-gray-500 text-sm font-bold">#{p.rank}</span>}
                    </span>
                    <p className="flex-1 font-medium text-white">{p.user_name}</p>
                    <span className="text-green-400 font-bold text-sm">{p.score}%</span>
                    <span className="text-gray-600 text-xs font-mono">{Math.round((p.total_time_ms || 0) / 1000)}s</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
