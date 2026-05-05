'use strict';

const Docker = require('dockerode');
const { v4: uuid } = require('uuid');
const path = require('path');
const os = require('os');
const fs = require('fs');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const IMAGES = {
  javascript: 'node:20-alpine',
  python:     'python:3.12-alpine',
};

const RUN_CMD = {
  javascript: (file) => ['node', file],
  python:     (file) => ['python3', file],
};

const FILE_EXT = {
  javascript: 'js',
  python:     'py',
};

/**
 * Run one test case in a Docker container with resource limits.
 * Returns { passed, stdout, stderr, timeMs, error }
 */
async function runTestCase({ language, code, input, expected, timeLimit = 5000, memLimitMb = 256 }) {
  const ext      = FILE_EXT[language];
  const tmpDir   = path.join(os.tmpdir(), `gwt-${uuid()}`);
  const codeFile = path.join(tmpDir, `solution.${ext}`);
  const inputFile= path.join(tmpDir, 'input.txt');

  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(codeFile, code, 'utf8');
  fs.writeFileSync(inputFile, input, 'utf8');

  const containerFile = `/sandbox/solution.${ext}`;
  const containerInput= `/sandbox/input.txt`;

  // Build shell command: redirect stdin from file
  let cmd: string[];
  if (language === 'javascript') {
    cmd = ['sh', '-c', `node ${containerFile} < ${containerInput}`];
  } else {
    cmd = ['sh', '-c', `python3 ${containerFile} < ${containerInput}`];
  }

  let container: any;
  const start = Date.now();

  try {
    container = await docker.createContainer({
      Image:       IMAGES[language],
      Cmd:         cmd,
      AttachStdout: true,
      AttachStderr: true,
      NetworkDisabled: true,         // No network access
      ReadonlyRootfs:  false,
      HostConfig: {
        Memory:            memLimitMb * 1024 * 1024,
        MemorySwap:        memLimitMb * 1024 * 1024,
        CpuPeriod:         100000,
        CpuQuota:          50000,     // 50% of one CPU
        PidsLimit:         64,        // Limit process count (prevent fork bombs)
        NetworkMode:       'none',
        ReadonlyRootfs:    false,
        Binds:             [`${tmpDir}:/sandbox:ro`],
        AutoRemove:        false,
        CapDrop:           ['ALL'],   // Drop all Linux capabilities
        SecurityOpt:       ['no-new-privileges'],
      },
    });

    await container.start();

    // Wait with timeout
    const result = await Promise.race([
      container.wait(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), timeLimit + 1000),
      ),
    ]) as any;

    const timeMs = Date.now() - start;

    const logs = await container.logs({
      stdout: true, stderr: true, follow: false,
    });

    const { stdout, stderr } = parseLogs(logs);
    const passed = stdout.trim() === expected.trim();

    return { passed, stdout: stdout.trim(), stderr: stderr.trim(), timeMs, error: null };
  } catch (err) {
    const timeMs = Date.now() - start;
    if (err.message === 'TIMEOUT') {
      return { passed: false, stdout: '', stderr: '', timeMs, error: 'TLE', timedOut: true };
    }
    return { passed: false, stdout: '', stderr: err.message, timeMs, error: err.message };
  } finally {
    // Cleanup
    try { if (container) await container.remove({ force: true }); } catch {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

/** Parse Docker multiplexed log stream */
function parseLogs(buffer: Buffer): { stdout: string; stderr: string } {
  let stdout = '';
  let stderr = '';
  let offset = 0;

  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) break;
    const streamType = buffer[offset];
    const size       = buffer.readUInt32BE(offset + 4);
    offset += 8;

    const chunk = buffer.slice(offset, offset + size).toString('utf8');
    offset += size;

    if (streamType === 1) stdout += chunk;
    else if (streamType === 2) stderr += chunk;
  }

  return { stdout, stderr };
}

/**
 * Run all test cases sequentially and return aggregated results.
 */
async function executeAll({ language, code, testCases, timeLimit = 5000, memLimit = 256 }) {
  if (!IMAGES[language]) {
    return { error: `Unsupported language: ${language}` };
  }

  // Pull image if not available (first run)
  try {
    await docker.getImage(IMAGES[language]).inspect();
  } catch {
    await new Promise<void>((resolve, reject) => {
      docker.pull(IMAGES[language], (err: any, stream: any) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, (err: any) => err ? reject(err) : resolve());
      });
    });
  }

  const results: any[] = [];
  let timedOut = false;
  let totalTimeMs = 0;

  for (const tc of testCases) {
    const r = await runTestCase({
      language, code, input: tc.input, expected: tc.expected,
      timeLimit, memLimitMb: memLimit,
    });
    results.push(r);
    totalTimeMs += r.timeMs;
    if (r.timedOut) { timedOut = true; break; }
  }

  return {
    results,
    timedOut,
    timeMs:   totalTimeMs,
    memoryMb: 0, // approximated
  };
}

module.exports = { executeAll };
