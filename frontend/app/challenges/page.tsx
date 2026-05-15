'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  Search, CheckCircle, RotateCcw, Shuffle, Zap, Filter,
  Code2, Trophy, Star, Flame, ArrowRight, Sparkles, Timer,
} from 'lucide-react';

const DIFF_CONFIG: Record<string, { label: string; badge: string; dot: string; glow: string; reward: string }> = {
  easy:   { label: 'Easy',   badge: 'bg-green-900/40 text-green-400 border border-green-800/50',    dot: 'bg-green-400',  glow: 'hover:border-green-800/50',  reward: '$5' },
  medium: { label: 'Medium', badge: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800/50', dot: 'bg-yellow-400', glow: 'hover:border-yellow-800/50', reward: '$15' },
  hard:   { label: 'Hard',   badge: 'bg-red-900/40 text-red-400 border border-red-800/50',          dot: 'bg-red-400',    glow: 'hover:border-red-800/50',    reward: '$40' },
};

const AI_DIFFICULTIES = [
  { value: 'easy',   label: 'Easy',   color: 'text-green-400',  bg: 'bg-green-900/20 border-green-800/40 hover:bg-green-900/40',  reward: '$5' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-800/40 hover:bg-yellow-900/40', reward: '$15' },
  { value: 'hard',   label: 'Hard',   color: 'text-red-400',    bg: 'bg-red-900/20 border-red-800/40 hover:bg-red-900/40',         reward: '$40' },
];

export default function ChallengesPage() {
  const router = useRouter();
  const [challenges,    setChallenges]    = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [difficulty,    setDifficulty]    = useState('');
  const [randomLoading, setRandomLoading] = useState(false);
  const [aiLoading,     setAiLoading]     = useState<string | null>(null);
  const [aiError,       setAiError]       = useState('');

  useEffect(() => { if (!getToken()) router.push('/auth/login'); }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search)     params.set('search', search);
    if (difficulty) params.set('difficulty', difficulty);
    api.get(`/challenges?${params}&limit=100`)
      .then(r => setChallenges(r.data.challenges || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, difficulty]);

  useEffect(() => { load(); }, [load]);

  const handleRandom = async () => {
    setRandomLoading(true);
    try {
      const res = await api.get('/challenges/random' + (difficulty ? `?difficulty=${difficulty}` : ''));
      if (res.data.id) router.push(`/challenges/${res.data.id}`);
    } catch {}
    finally { setRandomLoading(false); }
  };

  const handleAiGenerate = async (diff: string) => {
    setAiLoading(diff); setAiError('');
    try {
      const res = await api.post('/challenges/ai-generate', { difficulty: diff });
      if (res.data.id) router.push(`/challenges/${res.data.id}`);
      else setAiError('Could not generate challenge. Try again.');
    } catch { setAiError('AI generation failed. Try again.'); }
    finally { setAiLoading(null); }
  };

  const solved    = challenges.filter(c => Number(c.user_solved) === 1).length;
  const attempted = challenges.filter(c => !Number(c.user_solved) && Number(c.user_attempts) > 0).length;
  const total     = challenges.length;
  const pct       = total > 0 ? Math.round((solved / total) * 100) : 0;

  const diffCounts = { easy: 0, medium: 0, hard: 0 } as Record<string, number>;
  const diffSolved = { easy: 0, medium: 0, hard: 0 } as Record<string, number>;
  challenges.forEach(c => {
    if (diffCounts[c.difficulty] !== undefined) {
      diffCounts[c.difficulty]++;
      if (Number(c.user_solved) === 1) diffSolved[c.difficulty]++;
    }
  });

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <Code2 className="w-6 h-6 text-green-400" /> Challenges
            </h1>
            <p className="text-gray-500 text-sm mt-1 flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-orange-400" />
              5 minutes per challenge · Earn real rewards for correct solutions
            </p>
          </div>
          {total > 0 && (
            <div className="flex items-center gap-5 text-sm shrink-0">
              <span className="flex items-center gap-1.5 text-green-400 font-semibold">
                <CheckCircle className="w-3.5 h-3.5" /> {solved} solved
              </span>
              {attempted > 0 && <span className="text-yellow-500">{attempted} attempted</span>}
              <span className="text-gray-600">{total} total</span>
            </div>
          )}
        </div>

        {/* ── Progress + Stats ── */}
        {total > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-white">Overall Progress</span>
              <span className="text-sm font-black text-green-400">{solved}/{total} <span className="text-gray-500 font-normal">solved</span></span>
            </div>
            <div className="h-2.5 bg-gray-800 rounded-full mb-4 overflow-hidden">
              <div className="h-2.5 bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-700"
                style={{ width: `${pct}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(['easy', 'medium', 'hard'] as const).map(d => {
                const cfg = DIFF_CONFIG[d];
                const p = diffCounts[d] > 0 ? Math.round((diffSolved[d] / diffCounts[d]) * 100) : 0;
                return (
                  <button key={d} onClick={() => setDifficulty(difficulty === d ? '' : d)}
                    className={`rounded-xl p-3 text-center border transition-all ${
                      difficulty === d
                        ? cfg.badge + ' scale-[1.02]'
                        : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
                    }`}>
                    <p className={`text-lg font-black ${difficulty === d ? '' : 'text-white'}`}>{diffSolved[d]}<span className="text-xs font-normal text-gray-500">/{diffCounts[d]}</span></p>
                    <p className="text-xs text-gray-500">{cfg.label}</p>
                    <p className={`text-xs font-bold mt-1 ${difficulty === d ? '' : 'text-green-400'}`}>{cfg.reward}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Actions Row ── */}
        <div className="grid sm:grid-cols-2 gap-4">

          {/* Shuffle */}
          <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/10 border border-purple-800/30 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-purple-900/40 flex items-center justify-center shrink-0">
              <Shuffle className="w-5 h-5 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">Shuffle Challenge</p>
              <p className="text-gray-500 text-xs">Random unsolved {difficulty || 'challenge'} for you</p>
            </div>
            <button onClick={handleRandom} disabled={randomLoading}
              className="flex items-center gap-1.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-bold text-xs px-3 py-2 rounded-xl transition-all shrink-0">
              {randomLoading ? (
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              ) : <Shuffle className="w-3.5 h-3.5" />}
              Shuffle
            </button>
          </div>

          {/* AI Generate */}
          <div className="bg-gradient-to-br from-cyan-900/20 to-blue-900/10 border border-cyan-800/30 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl bg-cyan-900/40 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">AI-Generated Challenge</p>
                <p className="text-gray-500 text-xs">Fresh question created by AI just for you</p>
              </div>
            </div>
            {aiError && <p className="text-red-400 text-xs mb-2">{aiError}</p>}
            <div className="flex gap-2">
              {AI_DIFFICULTIES.map(d => (
                <button key={d.value} onClick={() => handleAiGenerate(d.value)} disabled={!!aiLoading}
                  className={`flex-1 flex flex-col items-center py-2 rounded-xl border text-xs font-bold transition-all disabled:opacity-50 ${d.bg}`}>
                  {aiLoading === d.value ? (
                    <svg className="w-3.5 h-3.5 animate-spin mb-0.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  ) : <Sparkles className={`w-3.5 h-3.5 mb-0.5 ${d.color}`} />}
                  <span className={d.color}>{d.label}</span>
                  <span className="text-gray-500">{d.reward}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Search + Filters ── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search challenges…"
              className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-green-600 transition-colors text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500 shrink-0" />
            {(['', 'easy', 'medium', 'hard'] as const).map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                  difficulty === d
                    ? d ? DIFF_CONFIG[d]?.badge : 'bg-green-900/30 text-green-400 border-green-800/50'
                    : 'bg-gray-800/50 text-gray-400 border-gray-700/50 hover:border-gray-600'
                }`}>
                {d ? DIFF_CONFIG[d].label : 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Challenge List ── */}
        {loading ? (
          <div className="space-y-2">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse flex items-center gap-4">
                <div className="w-5 h-5 bg-gray-800 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-800 rounded w-2/3" />
                  <div className="h-3 bg-gray-800 rounded w-1/3" />
                </div>
                <div className="h-5 w-16 bg-gray-800 rounded-full" />
              </div>
            ))}
          </div>
        ) : challenges.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-16 text-center">
            <Code2 className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400 font-semibold">No challenges found</p>
            <p className="text-gray-600 text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {/* Header row */}
            <div className="px-5 py-2.5 bg-gray-800/50 border-b border-gray-800 grid grid-cols-[2rem_1fr_auto_auto] gap-4 text-xs text-gray-500 font-semibold uppercase tracking-wider">
              <span>#</span>
              <span>Challenge</span>
              <span className="hidden sm:block text-right">Solves</span>
              <span className="text-right">Reward</span>
            </div>

            {challenges.map((c: any, i: number) => {
              const cfg = DIFF_CONFIG[c.difficulty] || DIFF_CONFIG.easy;
              const isSolved    = Number(c.user_solved) === 1;
              const isAttempted = !isSolved && Number(c.user_attempts) > 0;
              return (
                <Link key={c.id} href={`/challenges/${c.id}`}
                  className={`grid grid-cols-[2rem_1fr_auto_auto] gap-4 items-center px-5 py-3.5 border-b border-gray-800/60 last:border-0 hover:bg-gray-800/30 transition-colors group ${cfg.glow}`}>

                  {/* Index / Status */}
                  <div className="flex items-center justify-center">
                    {isSolved ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : isAttempted ? (
                      <RotateCcw className="w-4 h-4 text-yellow-500/70" />
                    ) : (
                      <span className="text-gray-600 text-sm font-mono">{i + 1}</span>
                    )}
                  </div>

                  {/* Title + meta */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-semibold text-sm truncate group-hover:text-green-300 transition-colors ${isSolved ? 'text-gray-400' : 'text-white'}`}>
                        {c.title}
                      </p>
                      {isSolved && (
                        <span className="text-xs text-green-500 font-semibold shrink-0 hidden sm:block">Solved</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5 mt-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${cfg.badge}`}>{cfg.label}</span>
                      {c.category && <span className="text-xs text-gray-600">{c.category}</span>}
                      {isAttempted && <span className="text-xs text-yellow-600">{c.user_attempts} tries</span>}
                    </div>
                  </div>

                  {/* Solve count */}
                  <div className="hidden sm:block text-right">
                    <span className="text-xs text-gray-500">{Number(c.accepted_count || 0).toLocaleString()}</span>
                  </div>

                  {/* Reward */}
                  <div className="text-right">
                    <span className={`text-xs font-black ${
                      c.difficulty === 'hard' ? 'text-red-400' :
                      c.difficulty === 'medium' ? 'text-yellow-400' : 'text-green-400'
                    }`}>{cfg.reward}</span>
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
