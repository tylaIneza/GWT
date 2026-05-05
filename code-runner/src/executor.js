'use strict';

const { spawn }   = require('child_process');
const { v4: uuid }= require('uuid');
const path        = require('path');
const os          = require('os');
const fs          = require('fs');

const LANG_CONFIG = {
  javascript: { ext: 'js', cmd: 'node',    args: (f) => [f] },
  python:     { ext: 'py', cmd: 'python3', args: (f) => [f] },
};

/**
 * Run one test case and return { passed, stdout, stderr, timeMs, timedOut }
 */
function runTestCase({ language, code, input, expected, timeLimit = 5000 }) {
  return new Promise((resolve) => {
    const cfg     = LANG_CONFIG[language];
    const tmpDir  = path.join(os.tmpdir(), `codearena-${uuid()}`);
    const codeFile= path.join(tmpDir, `solution.${cfg.ext}`);

    try {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(codeFile, code, 'utf8');
    } catch (e) {
      return resolve({ passed: false, stdout: '', stderr: e.message, timeMs: 0, error: e.message });
    }

    const start = Date.now();
    const proc  = spawn(cfg.cmd, cfg.args(codeFile), {
      cwd: tmpDir,
      env: { PATH: process.env.PATH },   // minimal env — no secrets
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    proc.stdout.on('data', (d) => {
      stdout += d.toString();
      if (stdout.length > 1_000_000) { proc.kill('SIGKILL'); killed = true; } // 1MB output cap
    });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    // Write input and close stdin
    if (input) {
      proc.stdin.write(input, 'utf8');
    }
    proc.stdin.end();

    // Hard timeout
    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGKILL');
    }, timeLimit);

    proc.on('close', (code) => {
      clearTimeout(timer);
      const timeMs = Date.now() - start;

      // Cleanup temp files
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

      if (killed && timeMs >= timeLimit - 100) {
        return resolve({ passed: false, stdout: '', stderr: 'Time Limit Exceeded', timeMs, timedOut: true });
      }

      const out    = stdout.trim();
      const exp    = expected.trim();
      const passed = out === exp;

      resolve({ passed, stdout: out, stderr: stderr.trim(), timeMs, timedOut: false });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      resolve({ passed: false, stdout: '', stderr: err.message, timeMs: Date.now() - start, error: err.message });
    });
  });
}

/**
 * Run all test cases sequentially.
 * Stops early on TLE.
 */
async function executeAll({ language, code, testCases, timeLimit = 5000 }) {
  if (!LANG_CONFIG[language]) {
    return { error: `Unsupported language: ${language}`, results: [] };
  }

  // Quick syntax/compilation check
  const firstResult = await runTestCase({
    language, code,
    input: testCases[0]?.input || '',
    expected: testCases[0]?.expected || '',
    timeLimit,
  });

  if (firstResult.error && !firstResult.timedOut) {
    return {
      results: testCases.map(() => ({ passed: false, stdout: '', stderr: firstResult.stderr, timeMs: 0 })),
      timedOut: false,
      error:    firstResult.stderr,
      timeMs:   firstResult.timeMs,
    };
  }

  const results = [firstResult];
  let timedOut  = firstResult.timedOut;
  let totalTime = firstResult.timeMs;

  for (let i = 1; i < testCases.length && !timedOut; i++) {
    const r = await runTestCase({
      language, code,
      input:    testCases[i].input,
      expected: testCases[i].expected,
      timeLimit,
    });
    results.push(r);
    totalTime += r.timeMs;
    if (r.timedOut) timedOut = true;
  }

  return { results, timedOut, timeMs: totalTime, memoryMb: 0 };
}

module.exports = { executeAll };
