'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Play, RotateCcw, ChevronDown, ChevronUp, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

// Load Monaco only on client side
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const TEMPLATES: Record<string, Record<string, string>> = {
  javascript: {
    default: `// Write your solution below
// Read input from process.stdin

const lines = require('fs').readFileSync('/dev/stdin', 'utf8').trim().split('\\n');

function solve(input) {
  // Your logic here
  return input;
}

console.log(solve(lines[0]));`,
  },
  python: {
    default: `# Write your solution below
import sys

def solve(input_data):
    # Your logic here
    return input_data

data = sys.stdin.read().strip()
print(solve(data))`,
  },
};

const DIFF_BADGE: Record<string, string> = {
  easy: 'badge-green', medium: 'badge-yellow', hard: 'badge-red',
};

interface TypingStats {
  keystrokes:         number;
  paste_count:        number;
  time_to_first_char: number;
  total_time_ms:      number;
  start_time:         number | null;
}

export default function ChallengePage() {
  const router     = useRouter();
  const { id }     = useParams<{ id: string }>();
  const [challenge, setChallenge]   = useState<any>(null);
  const [language,  setLanguage]    = useState('javascript');
  const [code,      setCode]        = useState(TEMPLATES.javascript.default);
  const [submitting,setSubmitting]  = useState(false);
  const [result,    setResult]      = useState<any>(null);
  const [descOpen,  setDescOpen]    = useState(true);
  const [tab,       setTab]         = useState<'description'|'submissions'>('description');
  const [subs,      setSubs]        = useState<any[]>([]);

  // Anti-cheat behavior tracking
  const stats = useRef<TypingStats>({
    keystrokes:         0,
    paste_count:        0,
    time_to_first_char: 0,
    total_time_ms:      0,
    start_time:         null,
  });
  const sessionStart = useRef(Date.now());

  useEffect(() => { if (!getToken()) router.push('/auth/login'); }, []);

  useEffect(() => {
    if (!id) return;
    api.get(`/challenges/${id}`).then(r => setChallenge(r.data)).catch(() => router.push('/challenges'));
  }, [id]);

  // Send device fingerprint to backend on mount
  useEffect(() => {
    const fp = [
      navigator.userAgent,
      screen.width + 'x' + screen.height,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language,
    ].join('|');
    const hash = btoa(fp).slice(0, 32);
    api.post('/anti-cheat/fingerprint', { fingerprint: hash }).catch(() => {});
  }, []);

  const onLanguageChange = (lang: string) => {
    setLanguage(lang);
    setCode(TEMPLATES[lang]?.default || '');
    stats.current = { keystrokes: 0, paste_count: 0, time_to_first_char: 0, total_time_ms: 0, start_time: null };
  };

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (!value) return;
    setCode(value);

    // Track first keystroke timing
    if (!stats.current.start_time) {
      stats.current.start_time         = Date.now();
      stats.current.time_to_first_char = Date.now() - sessionStart.current;
    }
    stats.current.keystrokes++;
  }, []);

  // Intercept paste events on the editor container
  const onEditorMount = (editor: any) => {
    editor.onDidPaste(() => {
      stats.current.paste_count++;
    });
    editor.onKeyDown(() => {
      if (!stats.current.start_time) {
        stats.current.start_time         = Date.now();
        stats.current.time_to_first_char = Date.now() - sessionStart.current;
      }
      stats.current.keystrokes++;
    });
  };

  const submit = async () => {
    if (!challenge || submitting) return;
    setSubmitting(true); setResult(null);

    stats.current.total_time_ms = Date.now() - sessionStart.current;

    try {
      const res = await api.post('/submissions', {
        challenge_id:  challenge.id,
        language,
        code,
        typing_stats: {
          keystrokes:         stats.current.keystrokes,
          paste_count:        stats.current.paste_count,
          time_to_first_char: stats.current.time_to_first_char,
          total_time_ms:      stats.current.total_time_ms,
        },
      });
      setResult(res.data);
      // Refresh submissions list
      api.get(`/submissions?challenge_id=${challenge.id}`).then(r => setSubs(r.data || []));
    } catch (e: any) {
      setResult({ error: e.response?.data?.message || e.response?.data?.error || 'Submission failed' });
    } finally { setSubmitting(false); }
  };

  const loadSubmissions = () => {
    if (!challenge) return;
    api.get(`/submissions?challenge_id=${challenge.id}`).then(r => setSubs(r.data || []));
  };

  if (!challenge) {
    return (
      <div className="min-h-screen bg-gray-950">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500 animate-pulse">Loading challenge...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Navbar />

      {/* Main layout: split pane */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>

        {/* LEFT: Problem description */}
        <div className="w-full lg:w-2/5 border-r border-gray-800 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-800 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="font-bold text-white text-lg leading-tight">{challenge.title}</h1>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`badge text-xs capitalize ${DIFF_BADGE[challenge.difficulty] || 'badge'}`}>{challenge.difficulty}</span>
                  {challenge.category && <span className="badge text-xs">{challenge.category}</span>}
                  <span className="text-xs text-gray-600">
                    <Clock className="w-3 h-3 inline mr-0.5" />{challenge.time_limit_ms / 1000}s
                  </span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 mt-4 border-b border-gray-800 -mx-5 px-5">
              {[
                { key: 'description', label: 'Description' },
                { key: 'submissions', label: 'Submissions' },
              ].map(t => (
                <button key={t.key} onClick={() => { setTab(t.key as any); if (t.key === 'submissions') loadSubmissions(); }}
                  className={`pb-2 mr-5 text-sm font-medium border-b-2 transition-colors ${
                    tab === t.key ? 'border-green-500 text-green-400' : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-5">
            {tab === 'description' && (
              <div className="space-y-5">
                <div className="prose prose-invert prose-sm max-w-none">
                  <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{challenge.description}</div>
                </div>

                {/* Sample test cases */}
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
                            <p className="text-gray-500 text-xs mb-1">Expected Output:</p>
                            <pre className="text-yellow-300 font-mono text-xs bg-gray-900 p-2 rounded-lg overflow-x-auto">{tc.expected_output}</pre>
                          </div>
                          {tc.explanation && <p className="text-gray-500 text-xs italic">{tc.explanation}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-600 bg-gray-800/50 rounded-xl p-3 space-y-1">
                  <p>⚡ Time limit: {challenge.time_limit_ms / 1000}s</p>
                  <p>💾 Memory limit: {challenge.memory_limit_mb}MB</p>
                  <p>📤 Max submissions: {challenge.max_submissions}/hour</p>
                </div>
              </div>
            )}

            {tab === 'submissions' && (
              <div className="space-y-2">
                {subs.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-8">No submissions yet</p>
                ) : (
                  subs.map((s: any) => (
                    <div key={s.id} className="bg-gray-800 rounded-xl px-4 py-3 flex items-center justify-between">
                      <div>
                        <span className={`badge text-xs ${
                          s.status === 'accepted' ? 'badge-green' :
                          s.status === 'wrong_answer' ? 'badge-red' : 'badge-yellow'
                        }`}>{s.status.replace(/_/g, ' ')}</span>
                        <p className="text-xs text-gray-500 mt-1 capitalize">{s.language} · {new Date(s.submitted_at).toLocaleString()}</p>
                      </div>
                      <span className={`font-bold text-sm ${s.score === 100 ? 'text-green-400' : 'text-gray-400'}`}>
                        {s.score}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Editor + Results */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Editor toolbar */}
          <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between shrink-0">
            <select value={language} onChange={e => onLanguageChange(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-green-500">
              {(challenge.supported_languages || ['javascript']).map((l: string) => (
                <option key={l} value={l} className="capitalize">{l}</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <button onClick={() => { setCode(TEMPLATES[language]?.default || ''); setResult(null); }}
                className="btn-ghost btn-sm">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
              <button onClick={submit} disabled={submitting}
                className="btn-primary btn-sm">
                <Play className="w-3.5 h-3.5" />
                {submitting ? 'Running...' : 'Submit'}
              </button>
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 overflow-hidden">
            <MonacoEditor
              height="100%"
              language={language}
              value={code}
              onChange={handleEditorChange}
              onMount={onEditorMount}
              theme="vs-dark"
              options={{
                fontSize:            14,
                minimap:             { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap:            'on',
                tabSize:             2,
                lineNumbers:         'on',
                renderLineHighlight: 'line',
                padding:             { top: 12 },
                // Anti-cheat: paste is allowed but tracked — a full disable would hurt UX
              }}
            />
          </div>

          {/* Result panel */}
          {(result || submitting) && (
            <div className="border-t border-gray-800 max-h-64 overflow-y-auto shrink-0">
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
                      {/* Summary */}
                      <div className={`flex items-center gap-3 p-3 rounded-xl ${
                        result.status === 'accepted' ? 'bg-green-900/30 border border-green-800' :
                        result.status === 'cheating_suspected' ? 'bg-orange-900/30 border border-orange-800' :
                        'bg-red-900/20 border border-red-800/50'
                      }`}>
                        {result.status === 'accepted'
                          ? <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                          : <XCircle    className="w-5 h-5 text-red-400   shrink-0" />}
                        <div className="flex-1">
                          <p className={`font-bold text-sm capitalize ${
                            result.status === 'accepted' ? 'text-green-400' :
                            result.status === 'cheating_suspected' ? 'text-orange-400' :
                            'text-red-400'
                          }`}>
                            {result.status.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {result.passed}/{result.total} test cases passed · {result.score}% ·{' '}
                            {result.time_ms ? `${result.time_ms}ms` : ''}
                          </p>
                        </div>
                      </div>

                      {/* Per-test results */}
                      {result.results?.length > 0 && (
                        <div className="space-y-1.5">
                          {result.results.map((r: any) => (
                            r.is_sample && (
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
                            )
                          ))}
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
