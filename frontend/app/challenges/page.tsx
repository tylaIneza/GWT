'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Search, CheckCircle, RotateCcw, Shuffle, Timer } from 'lucide-react';

const DIFF: Record<string, string> = { easy: 'diff-easy', medium: 'diff-medium', hard: 'diff-hard' };

export default function ChallengesPage() {
  const router = useRouter();
  const [challenges,    setChallenges]    = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [difficulty,    setDifficulty]    = useState('');
  const [randomLoading, setRandomLoading] = useState(false);
  const [randomError,   setRandomError]   = useState('');

  useEffect(() => { if (!getToken()) router.push('/auth/login'); }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search)     params.set('search', search);
    if (difficulty) params.set('difficulty', difficulty);
    api.get(`/challenges?${params}`)
      .then(r => setChallenges(r.data.challenges || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, difficulty]);

  const handleRandom = async () => {
    setRandomLoading(true); setRandomError('');
    try {
      const res = await api.get('/challenges/random');
      if (res.data.id) {
        router.push(`/challenges/${res.data.id}`);
      } else {
        setRandomError(res.data.message || 'No challenges available');
        setRandomLoading(false);
      }
    } catch {
      setRandomError('Could not get a random challenge');
      setRandomLoading(false);
    }
  };

  const solvedCount   = challenges.filter(c => Number(c.user_solved) === 1).length;
  const attemptedCount = challenges.filter(c => Number(c.user_solved) !== 1 && Number(c.user_attempts) > 0).length;

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Challenges</h1>
            <p className="text-gray-500 text-sm mt-1 flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-orange-400" />
              5-minute timer · Bet to earn multiplied rewards
            </p>
          </div>
          {challenges.length > 0 && (
            <div className="flex items-center gap-4 text-sm shrink-0">
              <span className="text-green-400 font-semibold">{solvedCount} solved</span>
              {attemptedCount > 0 && <span className="text-yellow-500">{attemptedCount} attempted</span>}
              <span className="text-gray-600">{challenges.length} total</span>
            </div>
          )}
        </div>

        {/* Surprise Me button */}
        <div className="card p-4 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1">
            <p className="text-white font-semibold">Feeling lucky?</p>
            <p className="text-gray-500 text-sm mt-0.5">Get a unique challenge no one else is currently solving. Timer starts immediately.</p>
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <button onClick={handleRandom} disabled={randomLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 to-pink-700 hover:from-purple-600 hover:to-pink-600 text-white font-bold text-sm transition-all disabled:opacity-50">
              <Shuffle className="w-4 h-4" />
              {randomLoading ? 'Finding challenge...' : 'Surprise Me!'}
            </button>
            {randomError && <p className="text-red-400 text-xs text-center">{randomError}</p>}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="input pl-10" placeholder="Search challenges..." />
          </div>
          <div className="flex gap-2">
            {['', 'easy', 'medium', 'hard'].map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={`btn btn-sm capitalize ${difficulty === d ? 'btn-primary' : 'btn-secondary'}`}>
                {d || 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="card p-5 animate-pulse flex items-center gap-4">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-800 rounded w-2/3" />
                  <div className="h-3 bg-gray-800 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : challenges.length === 0 ? (
          <div className="card p-12 text-center text-gray-500">No challenges found</div>
        ) : (
          <div className="card overflow-hidden divide-y divide-gray-800">
            {challenges.map((c: any, i: number) => {
              const solved   = Number(c.user_solved) === 1;
              const attempted = !solved && Number(c.user_attempts) > 0;
              return (
                <Link key={c.id} href={`/challenges/${c.id}`}
                  className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-800/30 transition-colors group ${solved ? 'opacity-70' : ''}`}>

                  <div className="w-6 shrink-0 flex items-center justify-center">
                    {solved ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : attempted ? (
                      <RotateCcw className="w-4 h-4 text-yellow-500/70" />
                    ) : (
                      <span className="text-gray-700 text-sm">{i + 1}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold transition-colors truncate ${
                      solved ? 'text-gray-400 group-hover:text-green-300' : 'text-white group-hover:text-green-300'
                    }`}>{c.title}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {c.category && <span className="text-xs text-gray-500">{c.category}</span>}
                      <span className="text-xs text-gray-600">{Number(c.accepted_count || 0).toLocaleString()} solved</span>
                      {attempted && (
                        <span className="text-xs text-yellow-600">{c.user_attempts} attempt{c.user_attempts > 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {solved && <span className="text-xs text-green-500 font-semibold hidden sm:block">Solved</span>}
                    <span className={`badge text-xs capitalize ${DIFF[c.difficulty] || 'badge'}`}>{c.difficulty}</span>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-500">{c.supported_languages?.join(' · ')}</p>
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
