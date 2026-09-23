import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const PORT = 3101;
const BASE = `http://127.0.0.1:${PORT}`;
const DB_FILE = path.join(ROOT, 'data', 'aetherdesk-smoke-test.db');

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
    if (Date.now() - start > timeoutMs) throw new Error('server did not become healthy in time');
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
      AETHER_TOKEN: '',
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

  it('GET /api/meta reports open-mode authRequired false', async () => {
    const res = await fetch(`${BASE}/api/meta`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.authRequired, false);
    assert.equal(typeof json.data.version, 'string');
    assert.ok(json.data.version.length > 0);
    assert.equal(typeof json.data.webhookKeep, 'number');
    assert.equal(typeof json.data.webhookTtlDays, 'number');
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

  it('backup export + import roundtrip', async () => {
    const exp = await fetch(`${BASE}/api/backup/export`);
    assert.equal(exp.status, 200);
    const payload = (await exp.json()).data;
    for (const k of ['tasks', 'snippets', 'scripts', 'notes']) {
      assert.ok(Array.isArray(payload[k]), `export missing array: ${k}`);
    }

    const bad = await fetch(`${BASE}/api/backup/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: 'nope' }),
    });
    assert.equal(bad.status, 400);

    const imp = await fetch(`${BASE}/api/backup/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tasks: payload.tasks,
        snippets: payload.snippets,
        scripts: payload.scripts,
        notes: [...payload.notes, {}],
      }),
    });
    assert.equal(imp.status, 200);
    const counts = (await imp.json()).data;
    assert.equal(counts.tasks, payload.tasks.length);
    assert.equal(counts.snippets, payload.snippets.length);
    assert.equal(counts.scripts, payload.scripts.length);
    assert.equal(counts.notes, payload.notes.length);
    assert.equal(counts.skipped, 1);
  });

  it('tasks CRUD + status move roundtrip', async () => {
    const created = await fetch(`${BASE}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'drag-me', priority: 'high', category: 'Test' }),
    });
    assert.equal(created.status, 200);
    const task = (await created.json()).data;
    assert.equal(task.status, 'todo');

    const moved = await fetch(`${BASE}/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    });
    assert.equal(moved.status, 200);
    assert.equal((await moved.json()).data.status, 'done');

    const del = await fetch(`${BASE}/api/tasks/${task.id}`, { method: 'DELETE' });
    assert.equal(del.status, 200);
  });

  it('snippet and script PATCH roundtrip', async () => {
    const postJSON = (url, body) => fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json());

    const snip = await postJSON(`${BASE}/api/snippets`, {
      title: 'patch-me', language: 'bash', code: 'echo 1', tags: 't',
    });
    assert.ok(snip.data.id);
    const snipPatch = await fetch(`${BASE}/api/snippets/${snip.data.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'patched', code: 'echo 2' }),
    });
    assert.equal(snipPatch.status, 200);
    assert.equal((await snipPatch.json()).data.title, 'patched');
    await fetch(`${BASE}/api/snippets/${snip.data.id}`, { method: 'DELETE' });

    const script = await postJSON(`${BASE}/api/scripts`, {
      name: 'patch-script', command: 'echo 1', category: 'Test',
    });
    assert.ok(script.data.id);
    const scriptPatch = await fetch(`${BASE}/api/scripts/${script.data.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'echo 2' }),
    });
    assert.equal(scriptPatch.status, 200);
    assert.equal((await scriptPatch.json()).data.command, 'echo 2');
    const scriptMissing = await fetch(`${BASE}/api/scripts/999999`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'echo x' }),
    });
    assert.equal(scriptMissing.status, 404);
    await fetch(`${BASE}/api/scripts/${script.data.id}`, { method: 'DELETE' });
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
