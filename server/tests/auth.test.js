import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const PORT = 3102;
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = 'secret123';
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const DB_FILE = path.join(ROOT, 'data', 'aetherdesk-auth-test.db');

function cleanDbArtifacts(file) {
  for (const p of [file, `${file}-wal`, `${file}-shm`]) {
    try { fs.unlinkSync(p); } catch {}
  }
}

let child = null;

async function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(`${BASE}/healthz`);
      if (res.ok) return;
    } catch {}
    if (Date.now() - start > timeoutMs) throw new Error('auth-mode server did not become healthy in time');
    await new Promise((r) => setTimeout(r, 300));
  }
}

before(async () => {
  cleanDbArtifacts(DB_FILE);
  child = spawn('node', ['server/index.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      AETHER_TOKEN: TOKEN,
      AUTH_TOKEN: '',
      AETHER_DB_PATH: DB_FILE,
    },
    stdio: 'ignore',
  });
  await waitForHealth();
});

after(() => {
  if (child) {
    child.kill('SIGTERM');
    child = null;
  }
  cleanDbArtifacts(DB_FILE);
});

describe('AetherDesk auth mode (AETHER_TOKEN set)', () => {
  it('GET /api/meta reports authRequired true and retention config', async () => {
    const res = await fetch(`${BASE}/api/meta`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.authRequired, true);
    assert.equal(json.data.version, PKG.version);
    assert.equal(typeof json.data.webhookKeep, 'number');
    assert.equal(typeof json.data.webhookTtlDays, 'number');
    assert.ok(Number.isInteger(json.data.webhookKeep) && json.data.webhookKeep >= 1);
    assert.ok(Number.isInteger(json.data.webhookTtlDays) && json.data.webhookTtlDays >= 1);
    assert.equal(typeof json.data.node, 'string');
    assert.ok(json.data.node.startsWith('v'));
    assert.equal(typeof json.data.platform, 'string');
    assert.ok(json.data.platform.length > 0);
  });

  it('dangerous endpoints return 401 without Bearer', async () => {
    const checks = [
      { method: 'POST', path: '/api/runner/run', body: { language: 'bash', code: 'echo no' } },
      { method: 'POST', path: '/api/proxy/request', body: { url: 'http://example.com', method: 'GET' } },
      { method: 'POST', path: '/api/system/kill-process', body: { pid: 1 } },
      { method: 'POST', path: '/api/scripts', body: { name: 'x', command: 'echo 1' } },
      { method: 'DELETE', path: '/api/webhooks' },
      { method: 'GET', path: '/api/backup/export' },
    ];
    for (const c of checks) {
      const res = await fetch(`${BASE}${c.path}`, {
        method: c.method,
        headers: c.body ? { 'Content-Type': 'application/json' } : undefined,
        body: c.body ? JSON.stringify(c.body) : undefined,
      });
      assert.equal(res.status, 401, `${c.method} ${c.path} expected 401, got ${res.status}`);
    }
  });

  it('Bearer token allows runner run and backup export', async () => {
    const run = await fetch(`${BASE}/api/runner/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ language: 'bash', code: 'echo ok' }),
    });
    assert.equal(run.status, 200);
    const runJson = await run.json();
    assert.equal(runJson.success, true);
    assert.match(runJson.data.stdout, /ok/);

    const exp = await fetch(`${BASE}/api/backup/export`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    assert.equal(exp.status, 200);
    const expJson = await exp.json();
    assert.equal(expJson.success, true);
    assert.ok(expJson.data);
  });
});
