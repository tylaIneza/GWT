'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  Play, RotateCcw, Clock, CheckCircle, XCircle,
  AlertTriangle, Coins, TrendingUp, TrendingDown,
  ChevronLeft, ChevronRight, Trophy, Timer,
} from 'lucide-react';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const TEMPLATES: Record<string, string> = {
  javascript: `// Write your solution below\n// Read input from process.stdin\n\nconst lines = require('fs').readFileSync('/dev/stdin', 'utf8').trim().split('\\n');\n\nfunction solve(input) {\n  // Your logic here\n  return input;\n}\n\nconsole.log(solve(lines[0]));`,
  python:     `# Write your solution below\nimport sys\n\ndef solve(input_data):\n    # Your logic here\n    return input_data\n\ndata = sys.stdin.read().strip()\nprint(solve(data))`,
};

const DIFF_BADGE: Record<string, string>      = { easy: 'badge-green', medium: 'badge-yellow', hard: 'badge-red' };
const DIFF_MULTIPLIER: Record<string, number> = { easy: 2,             medium: 3,              hard: 5          };
const DIFF_GLOW: Record<string, string> = {
  easy:   'border-green-700/60',
  medium: 'border-yellow-700/60',
  hard:   'border-red-700/60',
};
const DIFF_ACCENT: Record<string, string> = {
  easy:   'text-green-400',
  medium: 'text-yellow-400',
  hard:   'text-red-400',
};
const DIFF_BTN: Record<string, string> = {
  easy:   'bg-green-700 hover:bg-green-600',
  medium: 'bg-yellow-700 hover:bg-yellow-600',
  hard:   'bg-red-700 hover:bg-red-600',
};

interface TypingStats {
  keystrokes: number; paste_count: number;
  time_to_first_char: number; total_time_ms: number; start_time: number | null;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

export default function ChallengePage() {
  const router  = useRouter();
  const { id }  = useParams<{ id: string }>();

  const [challenge,     setChallenge]     = useState<any>(null);
  const [language,      setLanguage]      = useState('javascript');
  const [code,          setCode]          = useState(TEMPLATES.javascript);
  const [submitting,    setSubmitting]    = useState(false);
  const [result,        setResult]        = useState<any>(null);
  const [tab,           setTab]           = useState<'description' | 'submissions'>('description');
  const [subs,          setSubs]          = useState<any[]>([]);
  const [alreadySolved, setAlreadySolved] = useState(false);

  // Navigation
  const [challengeList, setChallengeList] = useState<{ id: string; title: string; user_solved: number }[]>([]);

  // Bet modal state
  const [showModal,  setShowModal]  = useState(false);
  const [betReady,   setBetReady]   = useState(false);
  const [betAmount,  setBetAmount]  = useState('');
  const [activeBet,  setActiveBet]  = useState<any>(null);
  const [betLoading, setBetLoading] = useState(false);
  const [betError,   setBetError]   = useState('');

  // Timer state
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [timeLeft,  setTimeLeft]  = useState<number | null>(null);
  const [timedOut,  setTimedOut]  = useState(false);
  const timedOutRef = useRef(false);

  const stats        = useRef<TypingStats>({ keystrokes: 0, paste_count: 0, time_to_first_char: 0, total_time_ms: 0, start_time: null });
  const sessionStart = useRef(Date.now());

  useEffect(() => { if (!getToken()) router.push('/auth/login'); }, []);

  // ── Load challenge + bet + session + list ─────────────────────
  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`/challenges/${id}`),
      api.get(`/bets/active?challenge_id=${id}`),
      api.get(`/challenges/${id}/session`).catch(() => ({ data: null })),
      api.get('/challenges?limit=100'),
    ]).then(([challengeRes, betRes, sessionRes, listRes]) => {
      const ch = challengeRes.data;
      setChallenge(ch);
      setChallengeList(listRes.data.challenges || []);

      const solved = Number(ch.user_stats?.solved) === 1;
      setAlreadySolved(solved);

      if (solved) {
        setBetReady(true);
        return;
      }

      // Restore existing active session
      const session = sessionRes.data;
      if (session && session.status === 'active') {
        const expTime = new Date(session.expires_at);
        if (expTime > new Date()) {
          setExpiresAt(session.expires_at);
          if (betRes.data) setActiveBet(betRes.data);
          setBetReady(true);
          return;
        }
        // Session expired while away
        setTimedOut(true);
        timedOutRef.current = true;
        setBetReady(true);
        return;
      }

      if (betRes.data) {
        setActiveBet(betRes.data);
      }
      setShowModal(true);
    }).catch(() => router.push('/challenges'));
  }, [id]);

  // ── Countdown timer ───────────────────────────────────────────
  useEffect(() => {
    if (!expiresAt || timedOut) return;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0 && !timedOutRef.current) {
        timedOutRef.current = true;
        setTimedOut(true);
        api.post(`/challenges/${id}/forfeit`).catch(() => {});
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);

  useEffect(() => {
    const fp   = [navigator.userAgent, screen.width + 'x' + screen.height, Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.language].join('|');
    const hash = btoa(fp).slice(0, 32);
    api.post('/anti-cheat/fingerprint', { fingerprint: hash }).catch(() => {});
  }, []);

  // ── Navigation helpers ────────────────────────────────────────
  const currentIndex  = challengeList.findIndex(c => c.id === id);
  const prevChallenge = currentIndex > 0 ? challengeList[currentIndex - 1] : null;
  const nextChallenge = currentIndex >= 0 && currentIndex < challengeList.length - 1 ? challengeList[currentIndex + 1] : null;
  const nextUnsolved  = challengeList.find(c => c.id !== id && Number(c.user_solved) !== 1) || nextChallenge;

  const onLanguageChange = (lang: string) => {
    setLanguage(lang);
    setCode(TEMPLATES[lang] || '');
    stats.current = { keystrokes: 0, paste_count: 0, time_to_first_char: 0, total_time_ms: 0, start_time: null };
  };

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (!value) return;
    setCode(value);
    if (!stats.current.start_time) {
      stats.current.start_time         = Date.now();
      stats.current.time_to_first_char = Date.now() - sessionStart.current;
    }
    stats.current.keystrokes++;
  }, []);

  const onEditorMount = (editor: any) => {
    editor.onDidPaste(() => { stats.current.paste_count++; });
    editor.onKeyDown(() => {
      if (!stats.current.start_time) {
        stats.current.start_time         = Date.now();
        stats.current.time_to_first_char = Date.now() - sessionStart.current;
      }
      stats.current.keystrokes++;
    });
  };

  // ── Start session (called after bet decision) ─────────────────
  const startSession = async () => {
    try {
      const res = await api.post(`/challenges/${id}/start`);
      setExpiresAt(res.data.expires_at);
    } catch {}
  };

  // ── Bet modal actions ─────────────────────────────────────────
  const confirmBet = async () => {
    const amount = Number(betAmount);
    if (!amount || amount < 100) { setBetError('Minimum bet is 100 RWF'); return; }
    setBetLoading(true); setBetError('');
    try {
      const res = await api.post('/bets', { challenge_id: id, amount });
      setActiveBet(res.data);
      setShowModal(false);
      setBetReady(true);
      await startSession();
    } catch (e: any) {
      setBetError(e.response?.data?.message || 'Failed to place bet');
    } finally { setBetLoading(false); }
  };

  const skipBet = async () => {
    setShowModal(false);
    setBetReady(true);
    await startSession();
  };

  // ── Submit ────────────────────────────────────────────────────
  const submit = async () => {
    if (!challenge || submitting || alreadySolved || timedOut) return;
    setSubmitting(true); setResult(null);
    stats.current.total_time_ms = Date.now() - sessionStart.current;
    try {
      const res = await api.post('/submissions', {
        challenge_id: challenge.id, language, code,
        typing_stats: {
          keystrokes:         stats.current.keystrokes,
          paste_count:        stats.current.paste_count,
          time_to_first_char: stats.current.time_to_first_char,
          total_time_ms:      stats.current.total_time_ms,
        },
      });
      setResult(res.data);
      if (res.data.bet?.resolved) setActiveBet(null);
      if (res.data.status === 'accepted') {
        setAlreadySolved(true);
        setChallengeList(prev => prev.map(c => c.id === id ? { ...c, user_solved: 1 } : c));
      }
      api.get(`/submissions?challenge_id=${challenge.id}`).then(r => setSubs(r.data || []));
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Submission failed';
      if (msg === 'already_solved') {
        setAlreadySolved(true);
        setResult({ error: 'You have already solved this challenge.' });
      } else if (msg === 'time_limit_exceeded') {
        setTimedOut(true);
        timedOutRef.current = true;
        setResult({ error: 'Time limit exceeded — your bet was forfeited.' });
      } else {
        setResult({ error: msg });
      }
    } finally { setSubmitting(false); }
  };

  const loadSubmissions = () => {
    if (!challenge) return;
    api.get(`/submissions?challenge_id=${challenge.id}`).then(r => setSubs(r.data || []));
  };

  // ── Loading skeleton ──────────────────────────────────────────
  if (!challenge) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navbar />
        <div className="flex items-center justify-center h-64 text-gray-500 animate-pulse">Loading challenge...</div>
      </div>
    );
  }

  const multiplier   = DIFF_MULTIPLIER[challenge.difficulty] || 2;
  const betAmountNum = Number(betAmount) || 0;
  const potentialWin = betAmountNum * multiplier;
  const diff         = challenge.difficulty as string;

  // Timer display
  const timerColor = timeLeft === null ? '' :
    timeLeft > 180 ? 'text-green-400' :
    timeLeft > 60  ? 'text-yellow-400' :
                     'text-red-400';
  const timerPulse = (timeLeft !== null && timeLeft <= 10 && !timedOut) ? 'animate-pulse' : '';

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Navbar />

      {/* ── BET CONFIRMATION MODAL ───────────────────────────── */}
      {showModal && !alreadySolved && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className={`w-full max-w-md bg-gray-900 border-2 rounded-2xl shadow-2xl ${DIFF_GLOW[diff] || 'border-gray-700'} overflow-hidden`}>

            <div className="px-6 pt-6 pb-4 border-b border-gray-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className={`badge text-xs capitalize ${DIFF_BADGE[diff] || 'badge'} mb-2`}>{diff} · {multiplier}× payout</span>
                  <h2 className="text-xl font-black text-white leading-tight">{challenge.title}</h2>
                  <div className="flex items-center gap-1.5 mt-2 text-gray-400 text-xs">
                    <Timer className="w-3.5 h-3.5 text-orange-400" />
                    <span>You'll have <strong className="text-orange-300">3 minutes</strong> to solve after starting</span>
                  </div>
                </div>
                <Coins className={`w-7 h-7 shrink-0 mt-1 ${DIFF_ACCENT[diff]}`} />
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              <p className="text-gray-400 text-sm">
                Place a bet before you start. If you solve it within 3 minutes you earn{' '}
                <span className={`font-bold ${DIFF_ACCENT[diff]}`}>{multiplier}× your bet</span>.
                If you fail or run out of time, the bet goes to the platform.
              </p>

              <div className="space-y-3">
                <label className="label">Bet Amount (RWF)</label>
                <input
                  type="number" min="100" placeholder="Enter amount, e.g. 500"
                  value={betAmount} onChange={e => { setBetAmount(e.target.value); setBetError(''); }}
                  className="input text-lg font-bold" autoFocus
                />
                <div className="flex gap-2">
                  {[500, 1000, 2000, 5000].map(v => (
                    <button key={v} onClick={() => setBetAmount(String(v))}
                      className="flex-1 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-colors">
                      {v.toLocaleString()}
                    </button>
                  ))}
                </div>

                {betAmountNum >= 100 && (
                  <div className="flex items-center justify-between bg-gray-800/60 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-xs text-gray-500">Your bet</p>
                      <p className="font-bold text-white">{betAmountNum.toLocaleString()} RWF</p>
                    </div>
                    <div className="text-center text-gray-600 text-xl">×{multiplier}</div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">If you win</p>
                      <p className={`text-2xl font-black ${DIFF_ACCENT[diff]}`}>{potentialWin.toLocaleString()} RWF</p>
                    </div>
                  </div>
                )}

                {betError && <p className="text-red-400 text-xs">{betError}</p>}
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={skipBet}
                  className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-sm transition-colors">
                  Skip — No Bet
                </button>
                <button
                  onClick={confirmBet}
                  disabled={betLoading || !betAmount || betAmountNum < 100}
                  className={`flex-1 py-3 rounded-xl text-white font-bold text-sm transition-colors disabled:opacity-40 ${DIFF_BTN[diff] || 'bg-green-700 hover:bg-green-600'}`}>
                  {betLoading ? 'Placing...' : `Bet ${betAmountNum >= 100 ? betAmountNum.toLocaleString() + ' RWF' : '...'}`}
                </button>
              </div>
              <p className="text-center text-xs text-gray-600">Timer starts immediately after you click Start or Bet</p>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN CHALLENGE LAYOUT ────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>

        {/* LEFT: Description */}
        <div className="w-full lg:w-2/5 border-r border-gray-800 flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 shrink-0">

            {alreadySolved && (
              <div className="flex items-center gap-2 bg-green-900/30 border border-green-700/50 rounded-xl px-4 py-2.5 mb-3">
                <Trophy className="w-4 h-4 text-green-400 shrink-0" />
                <span className="text-sm font-semibold text-green-300">You already solved this challenge!</span>
              </div>
            )}

            <div className="flex items-start gap-3">
              <div>
                <h1 className="font-bold text-white text-lg leading-tight">{challenge.title}</h1>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`badge text-xs capitalize ${DIFF_BADGE[diff] || 'badge'}`}>{diff}</span>
                  {challenge.category && <span className="badge text-xs">{challenge.category}</span>}
                  <span className="text-xs text-gray-600"><Clock className="w-3 h-3 inline mr-0.5" />{challenge.time_limit_ms / 1000}s exec</span>
                  {!alreadySolved && <span className={`text-xs font-bold ${DIFF_ACCENT[diff]}`}>{multiplier}× payout</span>}
                </div>
              </div>
            </div>

            <div className="flex gap-0 mt-4 border-b border-gray-800 -mx-5 px-5">
              {(['description', 'submissions'] as const).map(t => (
                <button key={t} onClick={() => { setTab(t); if (t === 'submissions') loadSubmissions(); }}
                  className={`pb-2 mr-5 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? 'border-green-500 text-green-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {tab === 'description' && (
              <>
                {activeBet && !alreadySolved && (
                  <div className={`rounded-xl border px-4 py-3 flex items-center justify-between ${
                    diff === 'easy'   ? 'border-green-700/50  bg-green-900/20'  :
                    diff === 'medium' ? 'border-yellow-700/50 bg-yellow-900/20' :
                                        'border-red-700/50    bg-red-900/20'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Coins className={`w-4 h-4 ${DIFF_ACCENT[diff]}`} />
                      <span className="text-sm font-semibold text-white">Bet active</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Staked → If win</p>
                      <p className={`font-black text-sm ${DIFF_ACCENT[diff]}`}>
                        {Number(activeBet.amount).toLocaleString()} → {Number(activeBet.potential_payout).toLocaleString()} RWF
                      </p>
                    </div>
                  </div>
                )}

                <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{challenge.description}</div>

                {challenge.test_cases?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-3">Examples</h3>
                    <div className="space-y-3">
                      {challenge.test_cases.map((tc: any, i: number) => (
                        <div key={tc.id} className="bg-gray-800 rounded-xl p-4 text-sm space-y-2">
                          <p className="text-gray-400 text-xs font-semibold uppercase">Example {i + 1}</p>
                          <div>
                            <p className="text-gray-500 text-xs mb-1">Input:</p>
                            <pre className="text-green-300 font-mono text-xs bg-gray-900 p-2 rounded-lg overflow-x-auto">{tc.input}</pre>
                          </div>
                          <div>
                            <p className="text-gray-500 text-xs mb-1">Expected:</p>
                            <pre className="text-yellow-300 font-mono text-xs bg-gray-900 p-2 rounded-lg overflow-x-auto">{tc.expected_output}</pre>
                          </div>
                          {tc.explanation && <p className="text-gray-500 text-xs italic">{tc.explanation}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-600 bg-gray-800/50 rounded-xl p-3 space-y-1">
                  <p>⚡ Execution limit: {challenge.time_limit_ms / 1000}s</p>
                  <p>💾 Memory: {challenge.memory_limit_mb}MB</p>
                  <p>📤 Max attempts: {challenge.max_submissions}/hour</p>
                </div>
              </>
            )}

            {tab === 'submissions' && (
              <div className="space-y-2">
                {subs.length === 0
                  ? <p className="text-gray-500 text-sm text-center py-8">No submissions yet</p>
                  : subs.map((s: any) => (
                    <div key={s.id} className="bg-gray-800 rounded-xl px-4 py-3 flex items-center justify-between">
                      <div>
                        <span className={`badge text-xs ${s.status === 'accepted' ? 'badge-green' : s.status === 'wrong_answer' ? 'badge-red' : 'badge-yellow'}`}>
                          {s.status.replace(/_/g, ' ')}
                        </span>
                        <p className="text-xs text-gray-500 mt-1 capitalize">{s.language} · {new Date(s.submitted_at).toLocaleString()}</p>
                      </div>
                      <span className={`font-bold text-sm ${s.score === 100 ? 'text-green-400' : 'text-gray-400'}`}>{s.score}%</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Editor + Results */}
        <div className="flex-1 flex flex-col overflow-hidden relative">

          {/* Lock overlay */}
          {!betReady && (
            <div className="absolute inset-0 z-10 bg-gray-950/80 backdrop-blur-sm flex items-center justify-center">
              <p className="text-gray-500 text-sm animate-pulse">Confirm your bet to start the timer…</p>
            </div>
          )}

          {/* TIME'S UP overlay */}
          {timedOut && (
            <div className="absolute inset-0 z-20 bg-gray-950/95 backdrop-blur-md flex items-center justify-center">
              <div className="text-center space-y-4 px-8">
                <div className="text-6xl mb-2">⏰</div>
                <h2 className="text-4xl font-black text-red-400">Time's Up!</h2>
                <p className="text-gray-400 text-sm">
                  {activeBet ? 'Your bet has been forfeited to the platform.' : 'The 3-minute window has ended.'}
                </p>
                <div className="flex gap-3 justify-center mt-6">
                  <button onClick={() => router.push('/challenges')}
                    className="px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold text-sm transition-colors">
                    Back to List
                  </button>
                  {nextUnsolved && (
                    <button onClick={() => router.push(`/challenges/${nextUnsolved.id}`)}
                      className="px-5 py-2.5 rounded-xl bg-green-700 hover:bg-green-600 text-white font-bold text-sm transition-colors">
                      Try Next Challenge
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              {/* Prev/Next navigation */}
              <button onClick={() => prevChallenge && router.push(`/challenges/${prevChallenge.id}`)}
                disabled={!prevChallenge} title={prevChallenge?.title}
                className="btn-ghost btn-sm disabled:opacity-30 px-2">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => nextChallenge && router.push(`/challenges/${nextChallenge.id}`)}
                disabled={!nextChallenge} title={nextChallenge?.title}
                className="btn-ghost btn-sm disabled:opacity-30 px-2">
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="w-px h-5 bg-gray-700 mx-1" />

              <select value={language} onChange={e => onLanguageChange(e.target.value)}
                disabled={!betReady || timedOut}
                className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-green-500 disabled:opacity-40">
                {(challenge.supported_languages || ['javascript']).map((l: string) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            {/* CENTER: Countdown Timer */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
              {timeLeft !== null && !alreadySolved && !timedOut && (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gray-900 border border-gray-700 ${timerPulse}`}>
                  <Timer className={`w-3.5 h-3.5 ${timerColor}`} />
                  <span className={`font-mono text-base font-bold tracking-widest ${timerColor}`}>
                    {formatTime(timeLeft)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => { setCode(TEMPLATES[language] || ''); setResult(null); }}
                disabled={!betReady || timedOut}
                className="btn-ghost btn-sm disabled:opacity-40">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
              {alreadySolved ? (
                <button onClick={() => nextUnsolved && router.push(`/challenges/${nextUnsolved.id}`)}
                  className="btn-primary btn-sm">
                  Next Challenge <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button onClick={submit} disabled={submitting || !betReady || timedOut}
                  className="btn-primary btn-sm disabled:opacity-40">
                  <Play className="w-3.5 h-3.5" />
                  {submitting ? 'Running...' : 'Submit'}
                </button>
              )}
            </div>
          </div>

          {/* Monaco */}
          <div className="flex-1 overflow-hidden">
            <MonacoEditor
              height="100%"
              language={language}
              value={code}
              onChange={handleEditorChange}
              onMount={onEditorMount}
              theme="vs-dark"
              options={{
                fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false,
                wordWrap: 'on', tabSize: 2, padding: { top: 12 },
                readOnly: !betReady || alreadySolved || timedOut,
              }}
            />
          </div>

          {/* Result panel */}
          {(result || submitting) && (
            <div className="border-t border-gray-800 max-h-72 overflow-y-auto shrink-0">
              {submitting && (
                <div className="p-5 flex items-center gap-3 text-gray-400">
                  <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                  Running against test cases...
                </div>
              )}

              {result && !submitting && (
                <div className="p-4 space-y-3">
                  {result.error ? (
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span className="text-sm">{result.error}</span>
                    </div>
                  ) : (
                    <>
                      <div className={`flex items-center gap-3 p-3 rounded-xl ${
                        result.status === 'accepted'           ? 'bg-green-900/30  border border-green-800'  :
                        result.status === 'cheating_suspected' ? 'bg-orange-900/30 border border-orange-800' :
                                                                  'bg-red-900/20    border border-red-800/50'
                      }`}>
                        {result.status === 'accepted'
                          ? <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                          : <XCircle    className="w-5 h-5 text-red-400   shrink-0" />}
                        <div className="flex-1">
                          <p className={`font-bold text-sm capitalize ${result.status === 'accepted' ? 'text-green-400' : result.status === 'cheating_suspected' ? 'text-orange-400' : 'text-red-400'}`}>
                            {result.status.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {result.passed}/{result.total} passed · {result.score}%{result.time_ms ? ` · ${result.time_ms}ms` : ''}
                          </p>
                        </div>
                        {result.status === 'accepted' && nextUnsolved && (
                          <button onClick={() => router.push(`/challenges/${nextUnsolved.id}`)}
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white text-xs font-bold transition-colors flex items-center gap-1">
                            Next <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {result.bet?.resolved && (
                        <div className={`flex items-center gap-3 p-3 rounded-xl ${result.bet.won ? 'bg-amber-900/30 border border-amber-700' : 'bg-gray-800 border border-gray-700'}`}>
                          {result.bet.won
                            ? <TrendingUp   className="w-5 h-5 text-amber-400 shrink-0" />
                            : <TrendingDown className="w-5 h-5 text-gray-500 shrink-0" />}
                          <div>
                            {result.bet.won ? (
                              <>
                                <p className="font-black text-amber-400 text-sm">Bet won!</p>
                                <p className="text-xs text-amber-300/80">{Number(result.bet.payout).toLocaleString()} RWF credited to your wallet</p>
                              </>
                            ) : (
                              <>
                                <p className="font-semibold text-gray-400 text-sm">Bet lost</p>
                                <p className="text-xs text-gray-500">Better luck next time!</p>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {result.results?.length > 0 && (
                        <div className="space-y-1.5">
                          {result.results.map((r: any) =>
                            r.is_sample ? (
                              <div key={r.test_case} className={`rounded-lg p-3 text-xs ${r.passed ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className={`font-semibold ${r.passed ? 'text-green-400' : 'text-red-400'}`}>
                                    {r.passed ? '✓' : '✗'} Test {r.test_case}
                                  </span>
                                  <span className="text-gray-500">{r.time_ms}ms</span>
                                </div>
                                {!r.passed && r.stdout !== undefined && (
                                  <div className="space-y-1">
                                    <p className="text-gray-500">Expected: <span className="text-yellow-300 font-mono">{r.expected}</span></p>
                                    <p className="text-gray-500">Got: <span className="text-red-300 font-mono">{r.stdout || '(empty)'}</span></p>
                                  </div>
                                )}
                              </div>
                            ) : null
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
