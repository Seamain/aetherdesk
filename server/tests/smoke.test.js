import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const PORT = 3101;
const BASE = `http://127.0.0.1:${PORT}`;

let child = null;

async function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(`${BASE}/healthz`);
      if (res.ok) return;
    } catch {}
    if (Date.now() - start > timeoutMs) throw new Error('server did not become healthy in time');
    await new Promise((r) => setTimeout(r, 300));
  }
}

before(async () => {
  child = spawn('node', ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  });
  await waitForHealth();
});

after(() => {
  if (child) child.kill('SIGTERM');
});

describe('AetherDesk smoke (open mode, no AETHER_TOKEN)', () => {
  it('GET /healthz returns ok', async () => {
    const res = await fetch(`${BASE}/healthz`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, 'ok');
  });

  it('GET /api/health returns success', async () => {
    const res = await fetch(`${BASE}/api/health`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
  });

  it('GET /api/system/status has cpu/memory/network/disk', async () => {
    const res = await fetch(`${BASE}/api/system/status`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    for (const k of ['cpu', 'memory', 'network', 'disk']) {
      assert.ok(json.data[k], `missing telemetry section: ${k}`);
    }
  });

  it('processes limit is clamped to <= 50', async () => {
    const res = await fetch(`${BASE}/api/system/processes?limit=9999`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length <= 50, `expected <=50, got ${json.data.length}`);
  });

  it('proxy blocks non-http protocols (SSRF guard)', async () => {
    const res = await fetch(`${BASE}/api/proxy/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'ftp://evil.example/file', method: 'GET' }),
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  it('proxy blocks cloud metadata IP', async () => {
    const res = await fetch(`${BASE}/api/proxy/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://169.254.169.254/latest/meta-data/', method: 'GET' }),
    });
    assert.equal(res.status, 403);
  });

  it('runner executes bash and rejects oversized code', async () => {
    const ok = await fetch(`${BASE}/api/runner/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'bash', code: 'echo smoke-ok' }),
    });
    assert.equal(ok.status, 200);
    const okJson = await ok.json();
    assert.match(okJson.data.stdout, /smoke-ok/);

    const big = await fetch(`${BASE}/api/runner/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'bash', code: 'x'.repeat(60000) }),
    });
    assert.equal(big.status, 400);
  });

  it('webhook single delete removes only that event', async () => {
    const topic = `del-${Date.now()}`;
    const put = await fetch(`${BASE}/api/webhooks/catch/${topic}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bye: true }),
    });
    const putJson = await put.json();
    const id = putJson.id;
    assert.ok(id);

    const del = await fetch(`${BASE}/api/webhooks/${id}`, { method: 'DELETE' });
    assert.equal(del.status, 200);

    const missing = await fetch(`${BASE}/api/webhooks/${id}`, { method: 'DELETE' });
    assert.equal(missing.status, 404);
  });

  it('webhook catch stores and lists event', async () => {
    const topic = `smoke-${Date.now()}`;
    const put = await fetch(`${BASE}/api/webhooks/catch/${topic}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hello: 'world' }),
    });
    assert.equal(put.status, 200);
    const putJson = await put.json();
    assert.equal(putJson.received, true);

    const list = await fetch(`${BASE}/api/webhooks`);
    assert.equal(list.status, 200);
    const listJson = await list.json();
    assert.ok(listJson.data.some((h) => h.endpoint === topic));
  });
});
