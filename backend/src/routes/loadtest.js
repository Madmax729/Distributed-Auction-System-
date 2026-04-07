// ─── Load Test Routes ─────────────────────────────────────────
// Triggers k6 load tests programmatically via child_process.
// k6 must be installed in the Docker container.
// ─────────────────────────────────────────────────────────────

const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const router = express.Router();

let activeLoadTest = null;

// POST /api/start-load-test
router.post('/start-load-test', (req, res) => {
  const {
    vus = 10,
    duration = '30s',
    auctionId,
  } = req.body;

  if (activeLoadTest) {
    return res.status(409).json({
      error: 'A load test is already running',
      message: 'Stop the current test before starting a new one',
    });
  }

  // k6 script is mounted at /app/k6/load-test.js via docker-compose volume
  const k6ScriptPath = path.resolve('/app/k6/load-test.js');

  const env = {
    ...process.env,
    AUCTION_ID: auctionId || '',
    BASE_URL: `http://nginx:80`,  // Inside Docker network
  };

  console.log(
    `[LoadTest] Starting k6: vus=${vus}, duration=${duration}, auctionId=${auctionId || '(auto-create)'}`
  );

  try {
    const k6Process = spawn('k6', [
      'run',
      `--vus=${vus}`,
      `--duration=${duration}`,
      k6ScriptPath,
    ], { env, stdio: ['ignore', 'pipe', 'pipe'] });

    activeLoadTest = k6Process;

    let output = '';

    k6Process.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log('[k6 stdout]', text);
      // Broadcast progress to clients
      if (global.io) {
        global.io.emit('load-test-output', { text, type: 'stdout' });
      }
    });

    k6Process.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log('[k6 stderr]', text);
      if (global.io) {
        global.io.emit('load-test-output', { text, type: 'stderr' });
      }
    });

    k6Process.on('error', (err) => {
      activeLoadTest = null;
      console.error('[LoadTest] k6 process error:', err.message);
      if (global.io) {
        global.io.emit('load-test-output', {
          text: `Error: ${err.message}. Is k6 installed in the container?`,
          type: 'stderr',
        });
        global.io.emit('load-test-complete', { code: -1, output: err.message });
      }
    });

    k6Process.on('close', (code) => {
      activeLoadTest = null;
      console.log(`[LoadTest] k6 exited with code ${code}`);
      if (global.io) {
        global.io.emit('load-test-complete', { code, output });
      }
    });

    res.json({
      message: 'Load test started',
      config: { vus, duration, auctionId: auctionId || '(k6 will auto-create)' },
    });

  } catch (err) {
    activeLoadTest = null;
    res.status(500).json({
      error: 'Failed to start k6',
      message: 'Make sure k6 is installed in the Docker container',
      details: err.message,
    });
  }
});

// POST /api/stop-load-test
router.post('/stop-load-test', (req, res) => {
  if (!activeLoadTest) {
    return res.status(404).json({ error: 'No active load test' });
  }

  activeLoadTest.kill('SIGTERM');
  activeLoadTest = null;

  res.json({ message: 'Load test stopped' });
});

// GET /api/load-test-status
router.get('/load-test-status', (req, res) => {
  res.json({ running: !!activeLoadTest });
});

module.exports = router;
