'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';
import { getToken } from '@/lib/auth';
import {
  Clock, CheckCircle, Trophy, Timer, Shuffle, Sparkles,
  Code2, Zap, Brain, ArrowRight, RotateCcw, Play,
  ChevronLeft, ChevronRight, XCircle,
} from 'lucide-react';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

/* ─── constants ─────────────────────────────────────────────────── */
const AUTO_DELAY = 3; // idle seconds before auto-check

const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript', available: true  },
  { id: 'typescript', label: 'TypeScript', available: true  },
  { id: 'python',     label: 'Python',     available: true  },
  { id: 'java',       label: 'Java',       available: true  },
  { id: 'cpp',        label: 'C++',        available: true  },
  { id: 'swift',      label: 'Swift',      available: true  },
  { id: 'ruby',       label: 'Ruby',       available: true  },
  { id: 'html',       label: 'HTML',       available: true  },
  { id: 'go',         label: 'Go',         available: false },
  { id: 'rust',       label: 'Rust',       available: false },
  { id: 'kotlin',     label: 'Kotlin',     available: false },
  { id: 'csharp',     label: 'C#',         available: false },
  { id: 'php',        label: 'PHP',        available: false },
];

/* ─── Per-language starter guide shown in the editor ────────────── */
const GUIDES: Record<string, string> = {
  javascript: `// HOW TO ANSWER
// 1. Read the input from stdin (it comes in as lines of text)
// 2. Process the input to solve the challenge
// 3. Print your answer using console.log()
//
// Example — reading input and printing output:
//
//   const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');
//   console.log(lines[0]);  // print first line
//
// The system checks your answer automatically every few seconds.
// START WRITING YOUR SOLUTION BELOW:
`,
  typescript: `// HOW TO ANSWER
// 1. Read input from stdin as lines of text
// 2. Solve the problem
// 3. Print your answer with console.log()
//
// Example:
//   import * as fs from 'fs';
//   const lines = fs.readFileSync('/dev/stdin','utf8').trim().split('\\n');
//   console.log(lines[0]);
//
// START WRITING YOUR SOLUTION BELOW:
`,
  python: `# HOW TO ANSWER
# 1. Read the input using input() or sys.stdin
# 2. Solve the problem
# 3. Print your answer using print()
#
# Example:
#   import sys
#   lines = sys.stdin.read().strip().split('\\n')
#   print(lines[0])
#
# START WRITING YOUR SOLUTION BELOW:
`,
  java: `// HOW TO ANSWER
// 1. Read input using Scanner
// 2. Solve the problem
// 3. Print your answer with System.out.println()
//
// Example:
//   Scanner sc = new Scanner(System.in);
//   String line = sc.nextLine();
//   System.out.println(line);
//
// Your class MUST be named Solution with a main method.
// START WRITING YOUR SOLUTION BELOW:
`,
  cpp: `// HOW TO ANSWER
// 1. Read input using cin or getline
// 2. Solve the problem
// 3. Print your answer with cout
//
// Example:
//   string line;
//   getline(cin, line);
//   cout << line << endl;
//
// START WRITING YOUR SOLUTION BELOW:
`,
  ruby: `# HOW TO ANSWER
# 1. Read input using $stdin or gets
# 2. Solve the problem
# 3. Print your answer using puts
#
# Example:
#   lines = $stdin.read.strip.split("\\n")
#   puts lines[0]
#
# START WRITING YOUR SOLUTION BELOW:
`,
  swift: `// HOW TO ANSWER
// 1. Read input using readLine()
// 2. Solve the problem
// 3. Print your answer with print()
//
// Example:
//   if let line = readLine() { print(line) }
//
// START WRITING YOUR SOLUTION BELOW:
`,
  go: `// HOW TO ANSWER
// 1. Read input using bufio.Scanner or fmt.Scan
// 2. Solve the problem
// 3. Print your answer with fmt.Println()
//
// Example:
//   scanner := bufio.NewScanner(os.Stdin)
//   scanner.Scan()
//   fmt.Println(scanner.Text())
//
// START WRITING YOUR SOLUTION BELOW:
`,
  rust: `// HOW TO ANSWER
// 1. Read input from stdin
// 2. Solve the problem
// 3. Print your answer with println!()
//
// Example:
//   let mut line = String::new();
//   std::io::stdin().read_line(&mut line).unwrap();
//   println!("{}", line.trim());
//
// START WRITING YOUR SOLUTION BELOW:
`,
  php: `<?php
// HOW TO ANSWER
// 1. Read input from stdin
// 2. Solve the problem
// 3. Print your answer with echo
//
// Example:
//   $lines = explode("\\n", trim(file_get_contents("php://stdin")));
//   echo $lines[0] . "\\n";
//
// START WRITING YOUR SOLUTION BELOW:
`,
  kotlin: `// HOW TO ANSWER
// 1. Read input using readLine()
// 2. Solve the problem
// 3. Print your answer with println()
//
// Example:
//   fun main() { println(readLine()!!) }
//
// START WRITING YOUR SOLUTION BELOW:
`,
  html: `<!-- HOW TO ANSWER
  1. Write your logic inside a <script> tag
  2. Read input: const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n')
  3. Print your answer: console.log(yourAnswer)
  The judge extracts your <script> content and runs it automatically.

  Example:
  <script>
    const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');
    console.log(lines[0]);
  </script>

  START WRITING YOUR SOLUTION BELOW:
-->
`,
};

const TEMPLATES: Record<string, string> = {
  javascript: `const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');
function solve(lines) {
  // your logic here
  return lines[0];
}
console.log(solve(lines));`,
  typescript: `import * as fs from 'fs';
const lines = fs.readFileSync('/dev/stdin','utf8').trim().split('\\n');
function solve(lines: string[]): string {
  return lines[0];
}
console.log(solve(lines));`,
  python: `import sys
lines = sys.stdin.read().strip().split('\\n')
def solve(lines):
    # your logic here
    return lines[0]
print(solve(lines))`,
  java: `import java.util.*;
public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String line = sc.nextLine();
        System.out.println(line);
    }
}`,
  cpp: `#include <bits/stdc++.h>
using namespace std;
int main() {
    string line;
    getline(cin, line);
    cout << line << endl;
}`,
  csharp: `using System;
class Solution {
    static void Main() { Console.WriteLine(Console.ReadLine()); }
}`,
  php: `<?php
$lines = explode("\\n", trim(file_get_contents("php://stdin")));
echo $lines[0] . "\\n";`,
  go: `package main
import ("bufio";"fmt";"os")
func main() {
    r := bufio.NewReader(os.Stdin)
    line, _ := r.ReadString('\\n')
    fmt.Println(line)
}`,
  rust: `use std::io::{self,BufRead};
fn main() {
    let l = io::stdin().lock().lines().next().unwrap().unwrap();
    println!("{}", l);
}`,
  swift: `import Foundation
let lines = AnyIterator { readLine() }.prefix(1000).compactMap{$0}
if let f = lines.first { print(f) }`,
  kotlin: `fun main(){ println(readLine()!!) }`,
  ruby:   `puts $stdin.read.strip.split("\\n")[0]`,
  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Solution</title>
</head>
<body>
<script>
const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');
function solve(lines) {
  // your logic here
  return lines[0];
}
console.log(solve(lines));
</script>
</body>
</html>`,
};

const DB: Record<string, string> = {
  easy:   'bg-green-900/40 text-green-400 border-green-800/50',
  medium: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/50',
  hard:   'bg-red-900/40 text-red-400 border-red-800/50',
};
const DGLOW:   Record<string, string> = { easy:'border-green-700/60',  medium:'border-yellow-700/60',  hard:'border-red-700/60' };
const DACC:    Record<string, string> = { easy:'text-green-400',       medium:'text-yellow-400',       hard:'text-red-400' };
const DBTN:    Record<string, string> = { easy:'bg-green-700 hover:bg-green-600', medium:'bg-yellow-700 hover:bg-yellow-600', hard:'bg-red-700 hover:bg-red-600' };
const DREWARD: Record<string, string> = { easy:'$5', medium:'$15', hard:'$40' };

const fmt = (s: number) =>
  `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

/* ─── Spinner helper ─────────────────────────────────────────────── */
const Spin = ({ cls = 'w-3.5 h-3.5' }: { cls?: string }) => (
  <svg className={`${cls} animate-spin`} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════════ */
export default function ChallengePage() {
  const router  = useRouter();
  const { id }  = useParams<{ id: string }>();

  /* UI state */
  const [challenge,     setChallenge]     = useState<any>(null);
  const [language,      setLanguage]      = useState('javascript');
  const [code,          setCode]          = useState(GUIDES.javascript);
  const [tab,           setTab]           = useState<'description'|'submissions'>('description');
  const [subs,          setSubs]          = useState<any[]>([]);

  /* session / game state */
  const [sessionReady,  setSessionReady]  = useState(false);
  const [showModal,     setShowModal]     = useState(false);
  const [startLoading,  setStartLoading]  = useState(false);
  const [expiresAt,     setExpiresAt]     = useState<string|null>(null);
  const [timeLeft,      setTimeLeft]      = useState<number|null>(null);
  const [timedOut,      setTimedOut]      = useState(false);
  const [solved,        setSolved]        = useState(false);
  const [showWin,       setShowWin]       = useState(false);
  const [challengeList, setChallengeList] = useState<any[]>([]);

  /* auto-check state */
  const [checking,      setChecking]      = useState(false);
  const [countdown,     setCountdown]     = useState<number|null>(null); // seconds remaining
  const [hasEdited,     setHasEdited]     = useState(false);
  const [checkCount,    setCheckCount]    = useState(0);
  const [liveResult,    setLiveResult]    = useState<any>(null);
  const [bestScore,     setBestScore]     = useState(0);
  const [bestPassed,    setBestPassed]    = useState(0);
  const [bestTotal,     setBestTotal]     = useState(0);

  /* navigation */
  const [shuffleLoading, setShuffleLoading] = useState(false);
  const [aiLoading,      setAiLoading]      = useState(false);

  /* refs — always up-to-date, safe to read inside stale closures */
  const codeRef        = useRef(code);
  const langRef        = useRef(language);
  const solvedRef      = useRef(false);
  const timedOutRef    = useRef(false);
  const sessionReadyRef= useRef(false);
  const checkingRef    = useRef(false);
  const fireAtRef      = useRef<number|null>(null);   // timestamp when next auto-check fires
  const tickerRef      = useRef<NodeJS.Timeout|null>(null);
  const keystrokesRef  = useRef(0);
  const pasteRef       = useRef(0);
  const sessionStart   = useRef(Date.now());
  const lastCheckAt    = useRef<number>(0);           // tracks cooldown (30s between checks)

  codeRef.current     = code;
  langRef.current     = language;
  solvedRef.current   = solved;
  timedOutRef.current = timedOut;
  sessionReadyRef.current = sessionReady;
  checkingRef.current = checking;

  /* ── auth guard ── */
  useEffect(() => { if (!getToken()) router.push('/auth/login'); }, []);

  /* ── load challenge ── */
  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`/challenges/${id}`),
      api.get(`/challenges/${id}/session`).catch(() => ({ data: null })),
      api.get('/challenges?limit=100'),
    ]).then(([cRes, sRes, lRes]) => {
      const ch = cRes.data;
      setChallenge(ch);
      setChallengeList(lRes.data.challenges || []);
      const wasSolved = Number(ch.user_stats?.solved) === 1;
      setSolved(wasSolved);
      solvedRef.current = wasSolved;
      if (wasSolved) {
        setSessionReady(true); sessionReadyRef.current = true;
        api.get(`/submissions?challenge_id=${ch.id}`).then(r => setSubs(r.data || []));
        return;
      }
      const sess = sRes.data;
      if (sess?.status === 'active') {
        setExpiresAt(sess.expires_at);
        setSessionReady(true);
        sessionReadyRef.current = true;
        return;
      }
      setShowModal(true);
    }).catch(() => router.push('/challenges'));
  }, [id]);

  /* ── session countdown ── */
  useEffect(() => {
    if (!expiresAt || timedOut) return;
    const tick = () => {
      const rem = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setTimeLeft(rem);
      if (rem === 0 && !timedOutRef.current) {
        timedOutRef.current = true;
        setTimedOut(true);
        stopTicker();
        api.post(`/challenges/${id}/forfeit`).catch(() => {});
      }
    };
    tick();
    const iv = setInterval(tick, 500);
    return () => clearInterval(iv);
  }, [expiresAt]);

  /* ── single master ticker (runs every 500ms) ───────────────────
     Reads fireAtRef to compute countdown. Fires runCheck when due.
     No stale closures — uses only refs.                          */
  useEffect(() => {
    const tick = () => {
      if (!fireAtRef.current) return;
      const rem = Math.ceil((fireAtRef.current - Date.now()) / 1000);
      if (rem <= 0) {
        fireAtRef.current = null;
        setCountdown(null);
        runCheck();           // all access through refs inside
      } else {
        setCountdown(rem);
      }
    };
    tickerRef.current = setInterval(tick, 500);
    return () => { if (tickerRef.current) clearInterval(tickerRef.current); };
  }, []); // mounts once — reads refs, never goes stale

  /* ── anti-cheat fingerprint ── */
  useEffect(() => {
    const fp = [navigator.userAgent, screen.width+'x'+screen.height,
                Intl.DateTimeFormat().resolvedOptions().timeZone].join('|');
    api.post('/anti-cheat/fingerprint', { fingerprint: btoa(fp).slice(0,32) }).catch(() => {});
  }, []);

  /* ── helpers ── */
  const stopTicker = () => { fireAtRef.current = null; setCountdown(null); };

  const COOLDOWN_MS = 3_000; // match backend submission_cooldown_seconds

  const armAutoCheck = () => {
    if (solvedRef.current || timedOutRef.current || !sessionReadyRef.current) return;
    // Don't schedule a check that would fire before the cooldown expires
    const cooldownEnds = lastCheckAt.current + COOLDOWN_MS;
    const fireAt = Math.max(Date.now() + AUTO_DELAY * 1000, cooldownEnds + 500);
    fireAtRef.current = fireAt;
    const secsUntil = Math.ceil((fireAt - Date.now()) / 1000);
    setCountdown(secsUntil);
  };

  const runCheck = async () => {
    if (checkingRef.current || solvedRef.current || timedOutRef.current) return;
    if (!codeRef.current.trim()) return; // don't check empty code
    checkingRef.current = true;
    lastCheckAt.current = Date.now();
    setChecking(true);
    setCheckCount(n => n + 1);
    try {
      const res = await api.post('/submissions', {
        challenge_id: id,
        language:     langRef.current,
        code:         codeRef.current,
        typing_stats: {
          keystrokes:         keystrokesRef.current,
          paste_count:        pasteRef.current,
          time_to_first_char: 0,
          total_time_ms:      Date.now() - sessionStart.current,
        },
      });
      const d = res.data;
      setLiveResult(d);
      if ((d.score || 0) > bestScore) {
        setBestScore(d.score || 0);
        setBestPassed(d.passed || 0);
        setBestTotal(d.total  || 0);
      }
      if (d.status === 'accepted') {
        solvedRef.current = true;
        setSolved(true);
        setShowWin(true);
        stopTicker();
        setChallengeList(prev => prev.map(c => c.id === id ? { ...c, user_solved: 1 } : c));
        api.get(`/submissions?challenge_id=${id}`).then(r => setSubs(r.data || []));
      }
    } catch (e: any) {
      const msg = e.response?.data?.message || '';
      if (msg === 'already_solved') { solvedRef.current = true; setSolved(true); setShowWin(true); stopTicker(); }
      if (msg === 'time_limit_exceeded') { timedOutRef.current = true; setTimedOut(true); stopTicker(); }
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  };

  /* ── editor handlers ── */
  const onLangChange = (lang: string) => {
    setLanguage(lang);
    langRef.current = lang;
    const guide = GUIDES[lang] || '';
    setCode(guide);
    codeRef.current = guide;
    keystrokesRef.current = 0;
    setHasEdited(false);
    setLiveResult(null);
    stopTicker();
  };

  const onCodeChange = (value: string | undefined) => {
    if (value === undefined) return;
    if (!sessionReadyRef.current || solvedRef.current || timedOutRef.current) return;
    codeRef.current = value;
    setCode(value);
    keystrokesRef.current++;
    const isGuide = value.trim() === (GUIDES[langRef.current] || '').trim();
    if (value.trim() && !isGuide) {
      setHasEdited(true);
      armAutoCheck();
    }
  };

  const onEditorMount = (editor: any) => {
    editor.onDidPaste(() => { pasteRef.current++; });
  };

  const startChallenge = async () => {
    setStartLoading(true);
    try {
      const res = await api.post(`/challenges/${id}/start`);
      setExpiresAt(res.data.expires_at);
      setSessionReady(true);
      sessionReadyRef.current = true;
      setShowModal(false);
    } finally { setStartLoading(false); }
  };

  const handleShuffle = async () => {
    setShuffleLoading(true);
    try {
      const res = await api.get('/challenges/random');
      if (res.data.id && res.data.id !== id) router.push(`/challenges/${res.data.id}`);
    } catch {} finally { setShuffleLoading(false); }
  };

  const handleAiGenerate = async () => {
    setAiLoading(true);
    try {
      const res = await api.post('/challenges/ai-generate', { difficulty: challenge?.difficulty || 'medium' });
      if (res.data.id) router.push(`/challenges/${res.data.id}`);
    } catch {} finally { setAiLoading(false); }
  };

  /* ── derived ── */
  const currentIndex  = challengeList.findIndex(c => c.id === id);
  const prevChallenge = currentIndex > 0 ? challengeList[currentIndex - 1] : null;
  const nextChallenge = currentIndex < challengeList.length - 1 ? challengeList[currentIndex + 1] : null;
  const nextUnsolved  = challengeList.find(c => c.id !== id && Number(c.user_solved) !== 1) || nextChallenge;

  const score  = liveResult?.score  ?? bestScore;
  const passed = liveResult?.passed ?? bestPassed;
  const total  = liveResult?.total  ?? bestTotal ?? challenge?.test_cases?.length ?? 0;

  if (!challenge) return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <Spin cls="w-5 h-5 text-green-400" /> Loading challenge…
        </div>
      </div>
    </div>
  );

  const diff       = challenge.difficulty as string;
  const timerColor = timeLeft === null ? 'text-gray-400' :
    timeLeft > 240 ? 'text-green-400' : timeLeft > 90 ? 'text-yellow-400' : 'text-red-400';
  const timerBg    = timeLeft === null ? 'bg-gray-900 border-gray-700' :
    timeLeft > 240 ? 'bg-green-900/20 border-green-800/40' :
    timeLeft > 90  ? 'bg-yellow-900/20 border-yellow-800/40' :
                     'bg-red-900/20 border-red-800/40';
  const timerPulse = (timeLeft !== null && timeLeft <= 30) ? 'animate-pulse' : '';

  /* ── score ring colours ── */
  const ringColor = score === 100 ? '#22c55e' : score >= 50 ? '#eab308' : score > 0 ? '#f97316' : '#374151';
  const scoreTextColor = score === 100 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : score > 0 ? 'text-orange-400' : 'text-gray-600';

  /* circumference for r=18: 2π*18 ≈ 113.1 */
  const CIRC = 2 * Math.PI * 18;

  /* ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <Navbar />

      {/* ── START MODAL ───────────────────────────────────────── */}
      {showModal && !solved && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className={`w-full max-w-md bg-gray-900 border-2 rounded-2xl shadow-2xl overflow-hidden ${DGLOW[diff]||'border-gray-700'}`}>
            <div className={`h-1 w-full ${diff==='easy'?'bg-green-500':diff==='medium'?'bg-yellow-500':'bg-red-500'}`} />
            <div className="px-6 pt-6 pb-4 border-b border-gray-800">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border capitalize inline-block mb-3 ${DB[diff]}`}>{diff}</span>
              <h2 className="text-xl font-black text-white mb-2">{challenge.title}</h2>
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-orange-400" />
                5 minutes · system auto-checks as you type
              </p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-800/60 rounded-xl p-3">
                  <p className="text-gray-500 text-xs mb-1">Reward</p>
                  <p className={`font-black text-xl ${DACC[diff]}`}>{DREWARD[diff]}</p>
                </div>
                <div className="bg-gray-800/60 rounded-xl p-3">
                  <p className="text-gray-500 text-xs mb-1">Timer</p>
                  <p className="font-black text-xl text-orange-400">5:00</p>
                </div>
                <div className="bg-gray-800/60 rounded-xl p-3">
                  <p className="text-gray-500 text-xs mb-1">Auto-check</p>
                  <p className="font-black text-xl text-cyan-400">{AUTO_DELAY}s</p>
                </div>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Start coding — the system checks your solution automatically every {AUTO_DELAY} seconds of idle time. Your score updates live.
              </p>
              <button onClick={startChallenge} disabled={startLoading}
                className={`w-full py-3.5 rounded-xl text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40 ${DBTN[diff]}`}>
                {startLoading ? <><Spin /> Starting…</> : <><Play className="w-4 h-4" /> Start Challenge (5:00)</>}
              </button>
              <button onClick={() => router.push('/challenges')} className="w-full text-center text-xs text-gray-500 hover:text-gray-300 transition-colors">
                ← Back to challenges
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN LAYOUT ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>

        {/* ── LEFT: Challenge question ─────────────────────────── */}
        <div className="w-full lg:w-[40%] border-r border-gray-800 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border capitalize ${DB[diff]}`}>{diff}</span>
              {challenge.category && (
                <span className="text-xs bg-gray-800 text-gray-400 border border-gray-700 px-2.5 py-0.5 rounded-full">{challenge.category}</span>
              )}
              {solved
                ? <span className="flex items-center gap-1 text-xs font-bold text-green-400"><CheckCircle className="w-3.5 h-3.5" /> Solved</span>
                : <span className={`text-xs font-black ${DACC[diff]}`}>{DREWARD[diff]}</span>
              }
            </div>
            <h1 className="text-xl font-black text-white leading-snug">{challenge.title}</h1>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* The question — plain and readable */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Your Task</p>
              <p className="text-gray-200 text-sm leading-relaxed">
                {challenge.description?.split('\n')[0]}
              </p>
            </div>

            {/* Examples — only if they exist */}
            {challenge.test_cases?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Examples</p>
                <div className="space-y-3">
                  {challenge.test_cases.slice(0, 2).map((tc: any, i: number) => (
                    <div key={tc.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-gray-500">Example {i + 1}</p>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <p className="text-xs text-gray-600 mb-1">Input</p>
                          <pre className="text-green-300 font-mono text-sm bg-gray-950 px-3 py-2 rounded-lg border border-gray-800">{tc.input}</pre>
                        </div>
                        <div className="flex items-center text-gray-600 pt-5">→</div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-600 mb-1">Output</p>
                          <pre className="text-yellow-300 font-mono text-sm bg-gray-950 px-3 py-2 rounded-lg border border-gray-800">{tc.expected_output}</pre>
                        </div>
                      </div>
                      {tc.explanation && (
                        <p className="text-xs text-gray-500 italic">{tc.explanation}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Past attempts */}
            {subs.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Your Attempts</p>
                <div className="space-y-2">
                  {subs.slice(0, 5).map((s: any) => (
                    <div key={s.id} className={`rounded-xl px-4 py-2.5 flex items-center justify-between border ${s.status==='accepted'?'bg-green-900/20 border-green-800/40':'bg-gray-800/50 border-gray-700/50'}`}>
                      <span className={`text-xs font-bold capitalize ${s.status==='accepted'?'text-green-400':s.status==='wrong_answer'?'text-red-400':'text-yellow-400'}`}>
                        {s.status==='accepted'?'✓ ':'✗ '}{s.status.replace(/_/g,' ')}
                      </span>
                      <span className={`font-black text-sm ${s.score===100?'text-green-400':'text-gray-400'}`}>{s.score}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── RIGHT: Score panel + Toolbar + Editor ────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden relative">

          {/* start lock */}
          {!sessionReady && (
            <div className="absolute inset-0 z-10 bg-gray-950/80 backdrop-blur-sm flex items-center justify-center">
              <p className="text-gray-500 text-sm animate-pulse">Starting session…</p>
            </div>
          )}

          {/* TIME'S UP */}
          {timedOut && !showWin && (
            <div className="absolute inset-0 z-20 bg-gray-950/95 backdrop-blur-md flex items-center justify-center">
              <div className="text-center px-8 max-w-sm">
                <div className="w-20 h-20 rounded-full bg-red-900/30 border-2 border-red-700/40 flex items-center justify-center mx-auto mb-5">
                  <Timer className="w-10 h-10 text-red-400" />
                </div>
                <h2 className="text-3xl font-black text-red-400 mb-2">Time's Up!</h2>
                <p className="text-gray-400 text-sm mb-1">
                  Final score: <span className={`font-black ${bestScore===100?'text-green-400':'text-yellow-400'}`}>{bestScore}%</span>
                  {bestTotal > 0 && <> ({bestPassed}/{bestTotal} tests)</>}
                </p>
                <p className="text-gray-600 text-sm mb-6">The 5-minute window has ended.</p>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => router.push('/challenges')} className="px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold text-sm">Back</button>
                  {nextUnsolved && (
                    <button onClick={() => router.push(`/challenges/${nextUnsolved.id}`)} className="px-5 py-2.5 rounded-xl bg-green-700 hover:bg-green-600 text-white font-bold text-sm flex items-center gap-1.5">
                      Next <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* WIN overlay */}
          {showWin && liveResult && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-gray-950/90 backdrop-blur-sm">
              <div className="w-full max-w-md mx-4 bg-gray-900 border-2 border-green-600/60 rounded-2xl overflow-hidden shadow-2xl">
                <div className="h-1.5 bg-gradient-to-r from-green-500 to-emerald-400" />
                <div className="p-6 text-center">
                  <div className="w-20 h-20 rounded-full bg-green-900/40 border-2 border-green-500/40 flex items-center justify-center mx-auto mb-4">
                    <Trophy className="w-10 h-10 text-yellow-400" />
                  </div>
                  <h2 className="text-2xl font-black text-green-400 mb-1">🎉 Accepted!</h2>
                  <p className="text-gray-400 text-sm mb-4">
                    {liveResult.passed}/{liveResult.total} tests · {liveResult.score}%
                    {liveResult.time_ms ? ` · ${liveResult.time_ms}ms` : ''}
                  </p>
                  {liveResult.reward > 0 && (
                    <div className="bg-green-900/30 border border-green-800/40 rounded-xl px-4 py-3 mb-4">
                      <p className="text-xs text-gray-500 mb-0.5">Reward credited to wallet</p>
                      <p className="text-3xl font-black text-green-400">+${Number(liveResult.reward).toFixed(2)}</p>
                    </div>
                  )}
                  {liveResult.ai_feedback && (
                    <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl p-4 mb-4 text-left">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">AI Feedback</span>
                      </div>
                      <p className="text-gray-300 text-xs leading-relaxed mb-1.5">{liveResult.ai_feedback.overall}</p>
                      {liveResult.ai_feedback.tip && (
                        <p className="text-xs text-yellow-400 flex items-start gap-1.5">
                          <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5" />{liveResult.ai_feedback.tip}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex gap-3">
                    {nextUnsolved && (
                      <button onClick={() => router.push(`/challenges/${nextUnsolved.id}`)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-xl">
                        Next <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => router.push('/challenges')}
                      className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-semibold rounded-xl">
                      All Challenges
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ LIVE SCORE PANEL — TOP ══════════════════════════ */}
          {sessionReady && !timedOut && (
            <div className="shrink-0 border-b border-gray-800 bg-gray-900/60">

              {/* Row 1: score ring + test dots + status */}
              <div className="px-4 py-2.5 flex items-center gap-4">

                {/* Score ring */}
                <div className="relative w-11 h-11 shrink-0">
                  <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
                    <circle cx="22" cy="22" r="18" fill="none" stroke="#1f2937" strokeWidth="4" />
                    <circle cx="22" cy="22" r="18" fill="none"
                      stroke={ringColor} strokeWidth="4" strokeLinecap="round"
                      strokeDasharray={`${CIRC}`}
                      strokeDashoffset={`${CIRC * (1 - score / 100)}`}
                      style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-[10px] font-black leading-none ${scoreTextColor}`}>{score}%</span>
                  </div>
                </div>

                {/* Test dots */}
                <div className="flex-1 min-w-0">
                  {liveResult?.results?.length > 0 ? (
                    <>
                      <div className="flex items-center gap-1 flex-wrap">
                        {liveResult.results.map((r: any, i: number) => (
                          <div key={i}
                            title={r.passed ? `Test ${i+1}: Passed (${r.time_ms}ms)` : `Test ${i+1}: Expected "${r.expected}" · got "${r.stdout||'no output'}"`}
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black cursor-default ${r.passed?'bg-green-500 text-white':'bg-red-500/70 text-white border border-red-400/40'}`}>
                            {r.passed ? '✓' : '✗'}
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {passed}/{total} passed · check #{checkCount}
                        {liveResult.time_ms ? ` · ${liveResult.time_ms}ms` : ''}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-600">
                      {hasEdited ? 'Checking your code…' : 'Start typing — score updates as you write'}
                    </p>
                  )}
                </div>

                {/* AI tip (compact) */}
                {liveResult?.ai_feedback?.tip && !solved && (
                  <div className="hidden lg:flex items-start gap-1.5 max-w-[220px] text-[11px] text-yellow-400/80 shrink-0">
                    <Zap className="w-3 h-3 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{liveResult.ai_feedback.tip}</span>
                  </div>
                )}

                {/* Solved badge */}
                {solved && (
                  <div className="flex items-center gap-1.5 text-green-400 font-bold text-sm shrink-0">
                    <CheckCircle className="w-4 h-4" /> Solved!
                  </div>
                )}
              </div>

              {/* Row 2: Auto-check countdown bar */}
              {hasEdited && !solved && (
                <div className="px-4 pb-2 flex items-center gap-3">
                  {checking ? (
                    <div className="flex items-center gap-2 text-[11px] text-green-400">
                      <Spin cls="w-3 h-3 text-green-400" /> Running test cases…
                    </div>
                  ) : countdown !== null && countdown > 0 ? (
                    <>
                      <span className="text-[11px] text-cyan-400 shrink-0 w-28">
                        Auto-check in <span className="font-black">{countdown}s</span>
                      </span>
                      <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-1 bg-cyan-500/70 rounded-full transition-all duration-500"
                          style={{ width: `${((AUTO_DELAY - countdown) / AUTO_DELAY) * 100}%` }} />
                      </div>
                    </>
                  ) : liveResult && liveResult.status !== 'accepted' ? (
                    <span className="text-[11px] text-gray-500">Edit your code to trigger another check</span>
                  ) : null}

                  {/* First failed test diff */}
                  {liveResult && !checking && liveResult.status !== 'accepted' && (() => {
                    const f = liveResult.results?.find((r: any) => !r.passed && r.is_sample);
                    return f ? (
                      <span className="text-[11px] text-gray-500 truncate hidden sm:block ml-auto">
                        Expected <span className="text-yellow-400 font-mono">{f.expected}</span>
                        {' · '}got <span className="text-red-400 font-mono">{f.stdout || 'empty'}</span>
                      </span>
                    ) : null;
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ══ TOOLBAR ══════════════════════════════════════════ */}
          <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between shrink-0 gap-2">
            <div className="flex items-center gap-1">
              <button onClick={() => prevChallenge && router.push(`/challenges/${prevChallenge.id}`)} disabled={!prevChallenge}
                className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => nextChallenge && router.push(`/challenges/${nextChallenge.id}`)} disabled={!nextChallenge}
                className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg disabled:opacity-30 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-gray-700 mx-1" />
              <button onClick={handleShuffle} disabled={shuffleLoading} title="Random challenge"
                className="p-1.5 text-purple-400 hover:bg-purple-900/20 rounded-lg disabled:opacity-50 transition-colors">
                {shuffleLoading ? <Spin /> : <Shuffle className="w-3.5 h-3.5" />}
              </button>
              <button onClick={handleAiGenerate} disabled={aiLoading} title="AI-generated challenge"
                className="p-1.5 text-cyan-400 hover:bg-cyan-900/20 rounded-lg disabled:opacity-50 transition-colors">
                {aiLoading ? <Spin /> : <Sparkles className="w-3.5 h-3.5" />}
              </button>
              <div className="w-px h-4 bg-gray-700 mx-1" />
              <select value={language} onChange={e => onLangChange(e.target.value)} disabled={!sessionReady || timedOut}
                className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-green-500 disabled:opacity-40 min-w-[120px]">
                {LANGUAGES.map(l => <option key={l.id} value={l.id} disabled={!l.available}>{l.label}{!l.available?' (soon)':''}</option>)}
              </select>
            </div>

            {/* Centre: session timer */}
            <div className="absolute left-1/2 -translate-x-1/2">
              {timeLeft !== null && !solved && !timedOut && (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border ${timerBg} ${timerPulse}`}>
                  <Timer className={`w-3.5 h-3.5 ${timerColor}`} />
                  <span className={`font-black font-mono text-sm tracking-widest ${timerColor}`}>{fmt(timeLeft)}</span>
                </div>
              )}
            </div>

            {/* Right: reset */}
            <button onClick={() => { const g=GUIDES[language]||''; setCode(g); codeRef.current=g; keystrokesRef.current=0; setHasEdited(false); setLiveResult(null); stopTicker(); }}
              disabled={!sessionReady || timedOut || solved}
              className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>

          {/* ══ MONACO EDITOR ════════════════════════════════════ */}
          <div className="flex-1 overflow-hidden min-h-0">
            <MonacoEditor
              height="100%"
              language={language === 'html' ? 'html' : language}
              value={code}
              onChange={onCodeChange}
              onMount={onEditorMount}
              theme="vs-dark"
              options={{
                fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false,
                wordWrap: 'on', tabSize: 2, padding: { top: 12 },
                readOnly: !sessionReady || solved || timedOut,
                placeholder: 'Write your solution here…',
              }}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
