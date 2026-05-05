'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Trophy, Users, Clock, Wallet } from 'lucide-react';

function CountDown({ end }: { end: string }) {
  const [left, setLeft] = useState('');
  useEffect(() => {
    const tick = () => {
      const ms = new Date(end).getTime() - Date.now();
      if (ms <= 0) { setLeft('Ended'); return; }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setLeft(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [end]);
  return <span className="text-amber-400 font-mono text-sm">{left}</span>;
}

export default function ContestsPage() {
  const router = useRouter();
  const [contests, setContests] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('');

  useEffect(() => { if (!getToken()) router.push('/auth/login'); }, []);

  useEffect(() => {
    const q = filter ? `?status=${filter}` : '';
    api.get(`/contests${q}`)
      .then(r => setContests(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  const STATUS_BADGE: Record<string, string> = {
    upcoming: 'badge-blue', active: 'badge-green', completed: 'badge', cancelled: 'badge-red',
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Contests</h1>
            <p className="text-gray-500 text-sm mt-1">Compete for real prize pools</p>
          </div>
          <div className="flex gap-2">
            {[['', 'All'], ['upcoming', 'Upcoming'], ['active', 'Live'], ['completed', 'Ended']].map(([v, l]) => (
              <button key={v} onClick={() => setFilter(v)}
                className={`btn btn-sm ${filter === v ? 'btn-primary' : 'btn-secondary'}`}>{l}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => <div key={i} className="card p-6 animate-pulse h-36" />)}
          </div>
        ) : contests.length === 0 ? (
          <div className="card p-16 text-center">
            <Trophy className="w-10 h-10 mx-auto text-gray-700 mb-3" />
            <p className="text-gray-500">No contests available right now</p>
            <p className="text-gray-600 text-sm mt-1">Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {contests.map((c: any) => (
              <Link key={c.id} href={`/contests/${c.id}`}
                className="card p-6 block hover:border-green-800/50 transition-all group">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`badge text-xs capitalize ${STATUS_BADGE[c.status] || 'badge'}`}>{c.status}</span>
                      {c.is_rated && <span className="badge text-xs">Rated</span>}
                    </div>
                    <h2 className="font-bold text-white text-lg group-hover:text-green-300 transition-colors">{c.title}</h2>
                    {c.description && <p className="text-gray-500 text-sm mt-1 line-clamp-2">{c.description}</p>}
                  </div>

                  {/* Prize */}
                  <div className="shrink-0 text-right">
                    <p className="text-2xl font-black text-green-400">{Number(c.prize_pool || 0).toLocaleString()}</p>
                    <p className="text-gray-500 text-xs">RWF prize pool</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  <div className="bg-gray-800 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-gray-500 mb-0.5">Entry Fee</p>
                    <p className="font-semibold text-white text-sm">
                      {Number(c.entry_fee) === 0 ? 'Free' : `${Number(c.entry_fee).toLocaleString()} RWF`}
                    </p>
                  </div>
                  <div className="bg-gray-800 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-gray-500 mb-0.5 flex items-center gap-1"><Users className="w-3 h-3" />Players</p>
                    <p className="font-semibold text-white text-sm">
                      {c.participant_count || 0}
                      {c.max_participants ? `/${c.max_participants}` : ''}
                    </p>
                  </div>
                  <div className="bg-gray-800 rounded-xl px-3 py-2.5 col-span-2">
                    <p className="text-xs text-gray-500 mb-0.5 flex items-center gap-1"><Clock className="w-3 h-3" />
                      {c.status === 'active' ? 'Ends in' : c.status === 'upcoming' ? 'Starts' : 'Ended'}
                    </p>
                    {c.status === 'active'
                      ? <CountDown end={c.end_time} />
                      : <span className="text-sm text-gray-300">{new Date(c.start_time).toLocaleString()}</span>
                    }
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
