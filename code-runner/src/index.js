'use strict';

const express = require('express');
const { executeAll } = require('./executor');

const app  = express();
const PORT = process.env.PORT || 3001;
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_EXECUTIONS || '10', 10);

app.use(express.json({ limit: '1mb' }));

// Simple in-memory concurrency limiter
let running = 0;

app.post('/execute', async (req, res) => {
  const { language, code, testCases, timeLimit, memLimit } = req.body;

  if (!language || !code || !Array.isArray(testCases)) {
    return res.status(400).json({ error: 'language, code, testCases required' });
  }

  if (code.length > 100_000) {
    return res.status(400).json({ error: 'Code too long (max 100KB)' });
  }

  if (running >= MAX_CONCURRENT) {
    return res.status(429).json({ error: 'Server busy, please try again' });
  }

  running++;
  try {
    const result = await executeAll({
      language,
      code,
      testCases: testCases.slice(0, 20), // hard limit
      timeLimit: Math.min(timeLimit || 5000, 10000),
      memLimit:  Math.min(memLimit || 256, 512),
    });
    res.json(result);
  } catch (err) {
    console.error('Execution error:', err.message);
    res.status(500).json({ error: 'Execution failed', details: err.message });
  } finally {
    running--;
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', running, max: MAX_CONCURRENT });
});

app.listen(PORT, () => {
  console.log(`Code runner listening on port ${PORT}`);
});
