'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { getToken, getUser } from '@/lib/auth';
import { Trophy, CheckCircle, Wallet } from 'lucide-react';

const MEDAL = ['🥇','🥈','🥉'];

export default function LeaderboardPage() {
  const router   = useRouter();
  const user     = getUser();
  const [data,   setData]    = useState<any[]>([]);
  const [loading,setLoading] = useState(true);

  useEffect(() => { if (!getToken()) router.push('/auth/login'); }, []);
  useEffect(() => {
    api.get('/leaderboard/global')
      .then(r => setData(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-400" /> Global Leaderboard
          </h1>
          <p className="text-gray-500 text-sm mt-1">Top performers ranked by problems solved</p>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => <div key={i} className="card p-4 animate-pulse h-14" />)}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-800">
                <tr>
                  {['#', 'Player', 'Solved', 'Earnings', 'Wins'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-semibold uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data.map((p: any, i: number) => (
                  <tr key={p.id} className={`transition-colors ${p.id === user?.id ? 'bg-green-900/10' : 'hover:bg-gray-800/20'}`}>
                    <td className="px-4 py-3 text-center">
                      {i < 3
                        ? <span className="text-xl">{MEDAL[i]}</span>
                        : <span className="text-gray-500 font-semibold">#{i + 1}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-green-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                          {p.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <p className={`font-semibold ${p.id === user?.id ? 'text-green-400' : 'text-white'}`}>
                            {p.name} {p.id === user?.id && <span className="text-xs text-gray-500">(you)</span>}
                          </p>
                          <p className="text-xs text-gray-500">{p.country_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-blue-400 font-semibold">
                        <CheckCircle className="w-3.5 h-3.5" />{p.problems_solved}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-green-400 font-semibold">
                        <Wallet className="w-3.5 h-3.5" />{Number(p.total_earnings || 0).toLocaleString()} RWF
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-yellow-400">
                        <Trophy className="w-3.5 h-3.5" />{p.wins || 0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.length === 0 && <div className="p-12 text-center text-gray-500">No data yet</div>}
          </div>
        )}
      </main>
    </div>
  );
}
