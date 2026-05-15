'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Trophy, Users, Clock, ArrowRight, Zap, Calendar, Lock, CheckCircle, Star } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string; glow: string }> = {
  active:    { label: 'Live',      badge: 'bg-green-900/40 text-green-400 border border-green-800/50',    dot: 'bg-green-400 animate-pulse', glow: 'border-green-800/40 hover:border-green-700/60' },
  upcoming:  { label: 'Upcoming',  badge: 'bg-blue-900/40 text-blue-400 border border-blue-800/50',       dot: 'bg-blue-400',                glow: 'border-gray-800 hover:border-blue-800/50' },
  completed: { label: 'Ended',     badge: 'bg-gray-800 text-gray-400 border border-gray-700',             dot: 'bg-gray-500',                glow: 'border-gray-800 hover:border-gray-700' },
  cancelled: { label: 'Cancelled', badge: 'bg-red-900/40 text-red-400 border border-red-800/50',          dot: 'bg-red-400',                 glow: 'border-gray-800' },
};

function Countdown({ end }: { end: string }) {
  const [parts, setParts] = useState({ h: 0, m: 0, s: 0, over: false });
  useEffect(() => {
    const tick = () => {
      const ms = new Date(end).getTime() - Date.now();
      if (ms <= 0) { setParts({ h: 0, m: 0, s: 0, over: true }); return; }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setParts({ h, m, s, over: false });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [end]);
  if (parts.over) return <span className="text-gray-500 font-mono text-sm">Ended</span>;
  return (
    <div className="flex items-center gap-1">
      {[
        { val: parts.h, unit: 'h' },
        { val: parts.m, unit: 'm' },
        { val: parts.s, unit: 's' },
      ].map(({ val, unit }) => (
        <div key={unit} className="flex items-center">
          <div className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 min-w-[32px] text-center">
            <span className="text-white font-black text-sm font-mono">{String(val).padStart(2,'0')}</span>
          </div>
          <span className="text-gray-600 text-xs mx-0.5">{unit}</span>
        </div>
      ))}
    </div>
  );
}

export default function ContestsPage() {
  const router = useRouter();
  const [contests, setContests] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('');

  useEffect(() => { if (!getToken()) router.push('/auth/login'); }, []);

  useEffect(() => {
    setLoading(true);
    const q = filter ? `?status=${filter}` : '';
    api.get(`/contests${q}`)
      .then(r => setContests(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  const FILTERS: { val: string; label: string; icon: any }[] = [
    { val: '',          label: 'All',      icon: Trophy },
    { val: 'active',   label: 'Live',     icon: Zap },
    { val: 'upcoming', label: 'Upcoming', icon: Calendar },
    { val: 'completed',label: 'Ended',    icon: CheckCircle },
  ];

  const live      = contests.filter(c => c.status === 'active').length;
  const upcoming  = contests.filter(c => c.status === 'upcoming').length;
  const totalPool = contests.filter(c => c.status !== 'cancelled').reduce((s, c) => s + Number(c.prize_pool || 0), 0);

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-400" /> Contests
            </h1>
            <p className="text-gray-500 text-sm mt-1">Compete for real money prizes in timed tournaments</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {live > 0 && (
              <span className="flex items-center gap-1.5 text-green-400 font-semibold animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> {live} Live
              </span>
            )}
            {upcoming > 0 && <span className="text-blue-400">{upcoming} upcoming</span>}
            {totalPool > 0 && <span className="text-yellow-400 font-bold">${totalPool.toLocaleString()} pool</span>}
          </div>
        </div>

        {/* ── Filter tabs ── */}
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
          {FILTERS.map(f => (
            <button key={f.val} onClick={() => setFilter(f.val)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                filter === f.val
                  ? 'bg-green-600 text-white shadow-lg shadow-green-900/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}>
              <f.icon className="w-3.5 h-3.5" />
              {f.label}
              {f.val === 'active' && live > 0 && (
                <span className="bg-green-400 text-gray-900 text-xs font-black rounded-full w-4 h-4 flex items-center justify-center">
                  {live}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 animate-pulse">
                <div className="flex justify-between mb-4">
                  <div className="space-y-2">
                    <div className="h-3 w-16 bg-gray-800 rounded-full" />
                    <div className="h-5 w-64 bg-gray-800 rounded" />
                  </div>
                  <div className="h-8 w-24 bg-gray-800 rounded" />
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[1,2,3,4].map(j => <div key={j} className="h-14 bg-gray-800 rounded-xl" />)}
                </div>
              </div>
            ))}
          </div>
        ) : contests.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-16 text-center">
            <Trophy className="w-14 h-14 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400 font-bold text-lg mb-1">No contests right now</p>
            <p className="text-gray-600 text-sm">Check back soon — new contests are added regularly</p>
          </div>
        ) : (
          <div className="space-y-4">
            {contests.map((c: any) => {
              const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.completed;
              const isLive   = c.status === 'active';
              const isUpcoming = c.status === 'upcoming';
              const isFree   = Number(c.entry_fee) === 0;
              return (
                <Link key={c.id} href={`/contests/${c.id}`}
                  className={`block bg-gray-900 border rounded-2xl overflow-hidden transition-all group hover:-translate-y-0.5 duration-200 ${cfg.glow}`}>

                  {/* Live banner */}
                  {isLive && (
                    <div className="bg-green-900/30 border-b border-green-800/40 px-5 py-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-xs text-green-400 font-bold uppercase tracking-wider">Contest is Live — Join Now</span>
                    </div>
                  )}

                  <div className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${cfg.badge}`}>
                            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                          {c.is_rated && (
                            <span className="text-xs bg-purple-900/40 text-purple-400 border border-purple-800/40 rounded-full px-2 py-0.5 font-semibold flex items-center gap-1">
                              <Star className="w-3 h-3" /> Rated
                            </span>
                          )}
                          {isFree && (
                            <span className="text-xs bg-green-900/30 text-green-400 border border-green-800/40 rounded-full px-2 py-0.5 font-semibold">Free Entry</span>
                          )}
                        </div>
                        <h2 className="font-black text-white text-xl group-hover:text-green-300 transition-colors mb-1">{c.title}</h2>
                        {c.description && (
                          <p className="text-gray-500 text-sm line-clamp-1">{c.description}</p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-3xl font-black text-green-400">${Number(c.prize_pool || 0).toLocaleString()}</p>
                        <p className="text-gray-500 text-xs mt-0.5">Prize Pool</p>
                        {isLive && (
                          <div className="mt-2 inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors">
                            Join Now <ArrowRight className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl px-3 py-2.5">
                        <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Lock className="w-3 h-3" /> Entry</p>
                        <p className="font-black text-white text-sm">
                          {isFree ? <span className="text-green-400">Free</span> : `$${Number(c.entry_fee).toLocaleString()}`}
                        </p>
                      </div>
                      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl px-3 py-2.5">
                        <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> Players</p>
                        <p className="font-black text-white text-sm">
                          {c.participant_count || 0}{c.max_participants ? <span className="text-gray-500 font-normal text-xs">/{c.max_participants}</span> : ''}
                        </p>
                      </div>
                      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl px-3 py-2.5 col-span-2">
                        <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {isLive ? 'Time Remaining' : isUpcoming ? 'Starts In' : 'Ended'}
                        </p>
                        {isLive ? (
                          <Countdown end={c.end_time} />
                        ) : isUpcoming ? (
                          <Countdown end={c.start_time} />
                        ) : (
                          <span className="text-sm text-gray-400">
                            {new Date(c.end_time || c.start_time).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
