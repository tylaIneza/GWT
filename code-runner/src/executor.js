'use strict';

const { spawn }   = require('child_process');
const { v4: uuid }= require('uuid');
const path        = require('path');
const os          = require('os');
const fs          = require('fs');

// ─── Language configurations ───────────────────────────────────────────────

const LANG_CONFIG = {
  javascript: {
    ext: 'js',
    type: 'interpreted',
    cmd: 'node',
    args: (f) => [f],
  },
  typescript: {
    ext: 'ts',
    type: 'interpreted',
    cmd: path.join(__dirname, '..', 'node_modules', '.bin', 'ts-node'),
    args: (f) => ['--skip-project', '--transpile-only', f],
  },
  python: {
    ext: 'py',
    type: 'interpreted',
    cmd: 'python3',
    args: (f) => [f],
  },
  ruby: {
    ext: 'rb',
    type: 'interpreted',
    cmd: 'ruby',
    args: (f) => [f],
  },
  php: {
    ext: 'php',
    type: 'interpreted',
    cmd: 'php',
    args: (f) => [f],
  },
  swift: {
    ext: 'swift',
    type: 'interpreted',
    cmd: 'swift',
    args: (f) => [f],
  },
  go: {
    ext: 'go',
    type: 'interpreted',
    cmd: 'go',
    args: (f) => ['run', f],
  },
  java: {
    ext: 'java',
    type: 'compiled',
    className: 'Solution',
    compile: (dir) => ({ cmd: 'javac', args: [path.join(dir, 'Solution.java')] }),
    run:     (dir) => ({ cmd: 'java',  args: ['-cp', dir, 'Solution'] }),
  },
  cpp: {
    ext: 'cpp',
    type: 'compiled',
    compile: (dir, src) => ({ cmd: 'g++', args: ['-O2', '-std=c++17', '-o', path.join(dir, 'solution'), src] }),
    run:     (dir)      => ({ cmd: path.join(dir, 'solution'), args: [] }),
  },
  csharp: {
    ext: 'cs',
    type: 'compiled',
    compile: (dir, src) => ({ cmd: 'mcs', args: ['-out:' + path.join(dir, 'solution.exe'), src] }),
    run:     (dir)      => ({ cmd: 'mono', args: [path.join(dir, 'solution.exe')] }),
  },
  rust: {
    ext: 'rs',
    type: 'compiled',
    compile: (dir, src) => ({ cmd: 'rustc', args: ['-o', path.join(dir, 'solution'), src] }),
    run:     (dir)      => ({ cmd: path.join(dir, 'solution'), args: [] }),
  },
  kotlin: {
    ext: 'kt',
    type: 'compiled',
    compile: (dir, src) => ({ cmd: 'kotlinc', args: [src, '-include-runtime', '-d', path.join(dir, 'solution.jar')] }),
    run:     (dir)      => ({ cmd: 'java', args: ['-jar', path.join(dir, 'solution.jar')] }),
  },
  html: {
    ext: 'html',
    type: 'interpreted',
    cmd: 'node',
    // extract all <script>...</script> bodies, concatenate, run as JS
    preprocess: (code) => {
      const scripts = [];
      const re = /<script(?:\s[^>]*)?>([^]*?)<\/script>/gi;
      let m;
      while ((m = re.exec(code)) !== null) scripts.push(m[1]);
      return scripts.length ? scripts.join('\n') : '// no script found';
    },
    args: (f) => [f],
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function runProcess(cmd, args, input, cwd, timeoutMs) {
  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawn(cmd, args, { cwd, env: { PATH: process.env.PATH, HOME: os.homedir() } });
    } catch (e) {
      return resolve({ ok: false, stdout: '', stderr: e.message, timeMs: 0 });
    }

    let stdout = '', stderr = '', killed = false;
    const start = Date.now();

    proc.stdout.on('data', (d) => {
      stdout += d.toString();
      if (stdout.length > 500_000) { proc.kill('SIGKILL'); killed = true; }
    });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    if (input) proc.stdin.write(input, 'utf8');
    proc.stdin.end();

    const timer = setTimeout(() => { killed = true; proc.kill('SIGKILL'); }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0 && !killed, stdout, stderr, timeMs: Date.now() - start, killed });
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, stdout: '', stderr: err.message, timeMs: Date.now() - start });
    });
  });
}

async function compileLang(cfg, dir, srcFile, timeoutMs = 20000) {
  const { cmd, args } = cfg.compile(dir, srcFile);
  const res = await runProcess(cmd, args, '', dir, timeoutMs);
  if (!res.ok) {
    return { error: res.stderr || res.stdout || 'Compilation failed' };
  }
  return { error: null };
}

// ─── Main test-case runner ─────────────────────────────────────────────────

async function runTestCase({ language, code, input, expected, timeLimit = 5000, compiled = null }) {
  const cfg = LANG_CONFIG[language];
  if (!cfg) return { passed: false, stdout: '', stderr: `Unsupported language: ${language}`, timeMs: 0 };

  // For HTML: extract <script> content and run as JS
  const runCode = cfg.preprocess ? cfg.preprocess(code) : code;
  // HTML runs as a .js file via node
  const runExt  = cfg.preprocess ? 'js' : cfg.ext;

  const tmpDir   = path.join(os.tmpdir(), `ca-${uuid()}`);
  const fileName = cfg.type === 'compiled' && cfg.className
    ? `${cfg.className}.${cfg.ext}`
    : `solution.${runExt}`;
  const srcFile  = path.join(tmpDir, fileName);

  try { fs.mkdirSync(tmpDir, { recursive: true }); } catch (e) {
    return { passed: false, stdout: '', stderr: e.message, timeMs: 0 };
  }

  try {
    fs.writeFileSync(srcFile, runCode, 'utf8');

    // Compile if needed (use cached binary dir or compile fresh)
    if (cfg.type === 'compiled' && !compiled) {
      const compResult = await compileLang(cfg, tmpDir, srcFile);
      if (compResult.error) {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
        return { passed: false, stdout: '', stderr: compResult.error, timeMs: 0, compileError: true };
      }
    }

    const runDir = compiled || tmpDir;
    const { cmd, args } = cfg.type === 'compiled'
      ? cfg.run(runDir)
      : { cmd: cfg.cmd, args: cfg.args(srcFile) };

    const res = await runProcess(cmd, args, input || '', tmpDir, timeLimit);

    const out    = res.stdout.trim();
    const exp    = (expected || '').trim();
    const passed = out === exp;

    return {
      passed,
      stdout:   out,
      stderr:   res.stderr.trim(),
      timeMs:   res.timeMs,
      timedOut: res.killed && res.timeMs >= timeLimit - 200,
    };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

// ─── Run all test cases ────────────────────────────────────────────────────

async function executeAll({ language, code, testCases, timeLimit = 5000 }) {
  const cfg = LANG_CONFIG[language];
  if (!cfg) return { error: `Unsupported language: ${language}`, results: [] };

  // For compiled languages: compile once, reuse binary
  let compiledDir = null;
  if (cfg.type === 'compiled') {
    compiledDir = path.join(os.tmpdir(), `ca-bin-${uuid()}`);
    const fileName = cfg.className ? `${cfg.className}.${cfg.ext}` : `solution.${cfg.ext}`;
    const srcFile  = path.join(compiledDir, fileName);
    try {
      fs.mkdirSync(compiledDir, { recursive: true });
      fs.writeFileSync(srcFile, code, 'utf8');
      const compResult = await compileLang(cfg, compiledDir, srcFile, 20000);
      if (compResult.error) {
        try { fs.rmSync(compiledDir, { recursive: true, force: true }); } catch {}
        return {
          error: compResult.error,
          results: testCases.map(() => ({ passed: false, stdout: '', stderr: compResult.error, timeMs: 0 })),
          timedOut: false,
        };
      }
    } catch (e) {
      return { error: e.message, results: [] };
    }
  }

  const results   = [];
  let   timedOut  = false;
  let   totalTime = 0;

  for (let i = 0; i < testCases.slice(0, 20).length && !timedOut; i++) {
    const tc = testCases[i];
    const r  = await runTestCase({
      language, code,
      input:    tc.input,
      expected: tc.expected,
      timeLimit,
      compiled: compiledDir,
    });
    results.push(r);
    totalTime += r.timeMs;
    if (r.timedOut) timedOut = true;
  }

  if (compiledDir) {
    try { fs.rmSync(compiledDir, { recursive: true, force: true }); } catch {}
  }

  return { results, timedOut, timeMs: totalTime, memoryMb: 0 };
}

module.exports = { executeAll };
