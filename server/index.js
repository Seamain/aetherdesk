import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

import { initDB, db } from './db.js';
import { getFullSystemTelemetry, getTopProcesses, killProcess } from './system.js';
import { runSnippetCode, executeAutomationScript } from './runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB schema & seeds
initDB();

const app = express();
const PORT = process.env.PORT || 3001;
const AUTH_TOKEN = process.env.AETHER_TOKEN || process.env.AUTH_TOKEN || '';

app.use(cors());
// Minimal security headers (no extra dep)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---- V1.2: optional Bearer auth for dangerous ops (local-first: open if no token set) ----
function requireAuth(req, res, next) {
  if (!AUTH_TOKEN) return next();
  const header = req.headers.authorization || '';
  const queryToken = req.query.token;
  if (header === `Bearer ${AUTH_TOKEN}` || (queryToken && queryToken === AUTH_TOKEN)) return next();
  return res.status(401).json({ success: false, error: 'Unauthorized: valid Bearer token required' });
}

// ---- V1.2: tiny in-memory sliding-window rate limiter (no dep) ----
const rateBuckets = new Map();
function rateLimit({ windowMs, max, keyPrefix }) {
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const arr = rateBuckets.get(key) || [];
    const fresh = arr.filter((t) => now - t < windowMs);
    if (fresh.length >= max) {
      return res.status(429).json({ success: false, error: `Rate limited: max ${max} per ${Math.round(windowMs / 1000)}s` });
    }
    fresh.push(now);
    rateBuckets.set(key, fresh);
    next();
  };
}
const limitRunner = rateLimit({ windowMs: 60_000, max: 10, keyPrefix: 'runner' });
const limitProxy = rateLimit({ windowMs: 60_000, max: 30, keyPrefix: 'proxy' });
const limitWebhookCatch = rateLimit({ windowMs: 60_000, max: 120, keyPrefix: 'whcatch' });
const limitKill = rateLimit({ windowMs: 60_000, max: 10, keyPrefix: 'kill' });

// Webhook retention: keep last 200 rows + drop older than 7 days
function pruneWebhooks() {
  try {
    db.prepare(`DELETE FROM webhooks WHERE id NOT IN (SELECT id FROM webhooks ORDER BY id DESC LIMIT 200)`).run();
    db.prepare(`DELETE FROM webhooks WHERE datetime(received_at) < datetime('now', '-7 days')`).run();
  } catch (_) {}
}
if (!AUTH_TOKEN) {
  console.log('⚠️  [AetherDesk] AETHER_TOKEN not set — dangerous APIs are open (LAN risk). Set env to enable Bearer auth.');
} else {
  console.log('🔐 [AetherDesk] Bearer auth enabled for kill/runner/proxy/scripts-management.');
}

// Create HTTP Server & WebSocket Server
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Broadcast helper for WebSockets
function broadcast(eventType, data) {
  const message = JSON.stringify({ type: eventType, data, timestamp: Date.now() });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// ---------------- WebSocket Telemetry Loop ----------------
let telemetryInterval = null;

wss.on('connection', async (ws) => {
  try {
    // Send immediate initial snapshot
    const initialData = await getFullSystemTelemetry();
    ws.send(JSON.stringify({ type: 'telemetry', data: initialData, timestamp: Date.now() }));
  } catch (err) {
    console.error('Initial telemetry error:', err);
  }

  ws.on('message', async (message) => {
    try {
      const parsed = JSON.parse(message.toString());
      if (parsed.action === 'refresh_processes') {
        const procs = await getTopProcesses(15);
        ws.send(JSON.stringify({ type: 'processes', data: procs, timestamp: Date.now() }));
      }
    } catch (e) {
      // ignore
    }
  });
});

// Periodic broadcast every 1200ms
telemetryInterval = setInterval(async () => {
  if (wss.clients.size > 0) {
    try {
      const metrics = await getFullSystemTelemetry();
      broadcast('telemetry', metrics);
    } catch (err) {
      console.error('Telemetry broadcast error:', err);
    }
  }
}, 1200);

// ---------------- REST API Endpoints ----------------

// 0. Health & Readiness (for daemon / reverse-proxy / container checks)
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', service: 'aetherdesk', timestamp: Date.now() });
});
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
});

// 1. System Endpoints
app.get('/api/system/status', async (req, res) => {
  try {
    const data = await getFullSystemTelemetry();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/system/processes', async (req, res) => {
  try {
    const rawLimit = parseInt(req.query.limit, 10) || 15;
    const limit = Math.min(Math.max(rawLimit, 1), 50);
    const processes = await getTopProcesses(limit);
    res.json({ success: true, data: processes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/system/kill-process', requireAuth, limitKill, async (req, res) => {
  try {
    const { pid } = req.body;
    if (!pid) return res.status(400).json({ success: false, error: 'PID is required' });
    const result = await killProcess(pid);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Tasks Endpoints (Kanban)
app.get('/api/tasks', (req, res) => {
  const rows = db.prepare('SELECT * FROM tasks ORDER BY id DESC').all();
  res.json({ success: true, data: rows });
});

app.post('/api/tasks', (req, res) => {
  const { title, description = '', status = 'todo', priority = 'medium', category = 'Dev', due_date = null } = req.body;
  if (!title) return res.status(400).json({ success: false, error: 'Title is required' });

  const stmt = db.prepare(`
    INSERT INTO tasks (title, description, status, priority, category, due_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(title, description, status, priority, category, due_date);
  const newTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);

  broadcast('task_created', newTask);
  res.json({ success: true, data: newTask });
});

app.patch('/api/tasks/:id', (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ success: false, error: 'Task not found' });

  const title = req.body.title !== undefined ? req.body.title : existing.title;
  const description = req.body.description !== undefined ? req.body.description : existing.description;
  const status = req.body.status !== undefined ? req.body.status : existing.status;
  const priority = req.body.priority !== undefined ? req.body.priority : existing.priority;
  const category = req.body.category !== undefined ? req.body.category : existing.category;
  const due_date = req.body.due_date !== undefined ? req.body.due_date : existing.due_date;

  db.prepare(`
    UPDATE tasks
    SET title = ?, description = ?, status = ?, priority = ?, category = ?, due_date = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(title, description, status, priority, category, due_date, id);

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  broadcast('task_updated', updated);
  res.json({ success: true, data: updated });
});

app.delete('/api/tasks/:id', (req, res) => {
  const id = req.params.id;
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  broadcast('task_deleted', { id });
  res.json({ success: true, message: 'Task deleted' });
});

// 3. Snippets Endpoints
app.get('/api/snippets', (req, res) => {
  const rows = db.prepare('SELECT * FROM snippets ORDER BY is_favorite DESC, id DESC').all();
  res.json({ success: true, data: rows });
});

app.post('/api/snippets', (req, res) => {
  const { title, language, code, tags = '', description = '', is_favorite = 0 } = req.body;
  if (!title || !code) return res.status(400).json({ success: false, error: 'Title and code are required' });

  const result = db.prepare(`
    INSERT INTO snippets (title, language, code, tags, description, is_favorite)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title, language || 'text', code, tags, description, is_favorite ? 1 : 0);

  const item = db.prepare('SELECT * FROM snippets WHERE id = ?').get(result.lastInsertRowid);
  res.json({ success: true, data: item });
});

app.patch('/api/snippets/:id', (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM snippets WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ success: false, error: 'Snippet not found' });

  const title = req.body.title ?? existing.title;
  const language = req.body.language ?? existing.language;
  const code = req.body.code ?? existing.code;
  const tags = req.body.tags ?? existing.tags;
  const description = req.body.description ?? existing.description;
  const is_favorite = req.body.is_favorite !== undefined ? (req.body.is_favorite ? 1 : 0) : existing.is_favorite;

  db.prepare(`
    UPDATE snippets
    SET title = ?, language = ?, code = ?, tags = ?, description = ?, is_favorite = ?
    WHERE id = ?
  `).run(title, language, code, tags, description, is_favorite, id);

  const updated = db.prepare('SELECT * FROM snippets WHERE id = ?').get(id);
  res.json({ success: true, data: updated });
});

app.delete('/api/snippets/:id', (req, res) => {
  db.prepare('DELETE FROM snippets WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// 4. Automation Scripts Endpoints
app.get('/api/scripts', (req, res) => {
  const rows = db.prepare('SELECT * FROM scripts ORDER BY id ASC').all();
  res.json({ success: true, data: rows });
});

app.post('/api/scripts', requireAuth, (req, res) => {
  const { name, command, category = 'Custom', description = '' } = req.body;
  if (!name || !command) return res.status(400).json({ success: false, error: 'Name and command required' });

  const result = db.prepare(`
    INSERT INTO scripts (name, command, category, description)
    VALUES (?, ?, ?, ?)
  `).run(name, command, category, description);

  const item = db.prepare('SELECT * FROM scripts WHERE id = ?').get(result.lastInsertRowid);
  res.json({ success: true, data: item });
});

app.post('/api/scripts/:id/run', requireAuth, async (req, res) => {
  try {
    const result = await executeAutomationScript(req.params.id);
    broadcast('script_executed', result);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/scripts/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM scripts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// 5. Code Sandbox Runner
app.post('/api/runner/run', requireAuth, limitRunner, async (req, res) => {
  const { language, code, timeoutMs } = req.body;
  if (!code) return res.status(400).json({ success: false, error: 'Code is required' });
  if (typeof code !== 'string' || code.length > 50000) {
    return res.status(400).json({ success: false, error: 'Code must be a string under 50KB' });
  }
  const clampedTimeout = Math.min(Math.max(parseInt(timeoutMs, 10) || 15000, 1000), 30000);

  const result = await runSnippetCode(language || 'bash', code, clampedTimeout);
  res.json({ success: true, data: result });
});

// 6. Webhooks Catch Box
app.get('/api/webhooks', (req, res) => {
  const rows = db.prepare('SELECT * FROM webhooks ORDER BY id DESC LIMIT 50').all();
  res.json({ success: true, data: rows });
});

app.delete('/api/webhooks', requireAuth, (req, res) => {
  db.prepare('DELETE FROM webhooks').run();
  res.json({ success: true, message: 'Cleared all webhooks' });
});

app.delete('/api/webhooks/:id', requireAuth, (req, res) => {
  const info = db.prepare('DELETE FROM webhooks WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ success: false, error: 'Webhook not found' });
  res.json({ success: true });
});

// Webhook receiver endpoint - handles any method (POST, GET, PUT, etc.)
app.all('/api/webhooks/catch/:endpoint', limitWebhookCatch, (req, res) => {
  const endpoint = req.params.endpoint;
  const method = req.method;
  const headers = JSON.stringify(req.headers);
  const query = JSON.stringify(req.query);
  const payload = typeof req.body === 'object' ? JSON.stringify(req.body) : String(req.body || '');
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

  const result = db.prepare(`
    INSERT INTO webhooks (endpoint, method, headers, query, payload, ip)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(endpoint, method, headers, query, payload, ip);

  const newHook = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(result.lastInsertRowid);
  broadcast('webhook_received', newHook);
  pruneWebhooks();

  res.status(200).json({
    received: true,
    id: result.lastInsertRowid,
    endpoint,
    method,
    timestamp: new Date().toISOString(),
    message: 'Webhook received by AetherDesk',
  });
});

// 7. Pomodoro Logs
app.get('/api/pomodoro/stats', (req, res) => {
  const logs = db.prepare('SELECT * FROM pomodoro_logs ORDER BY id DESC LIMIT 30').all();
  const todayCount = db.prepare(`
    SELECT count(*) as count, sum(duration_seconds) as total_seconds
    FROM pomodoro_logs
    WHERE date(completed_at) = date('now', 'localtime')
  `).get();

  res.json({
    success: true,
    data: {
      logs,
      today: {
        count: todayCount.count || 0,
        totalMinutes: Math.round((todayCount.total_seconds || 0) / 60),
      },
    },
  });
});

app.post('/api/pomodoro/log', (req, res) => {
  const { mode = 'work', duration_seconds, task_title = '' } = req.body;
  const result = db.prepare(`
    INSERT INTO pomodoro_logs (mode, duration_seconds, task_title)
    VALUES (?, ?, ?)
  `).run(mode, duration_seconds || 1500, task_title);

  res.json({ success: true, id: result.lastInsertRowid });
});

// 8. Notes Endpoints
app.get('/api/notes', (req, res) => {
  const rows = db.prepare('SELECT * FROM notes ORDER BY pinned DESC, id DESC').all();
  res.json({ success: true, data: rows });
});

app.post('/api/notes', (req, res) => {
  const { title, content = '', pinned = 0 } = req.body;
  if (!title) return res.status(400).json({ success: false, error: 'Title required' });

  const result = db.prepare(`
    INSERT INTO notes (title, content, pinned)
    VALUES (?, ?, ?)
  `).run(title, content, pinned ? 1 : 0);

  const item = db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid);
  res.json({ success: true, data: item });
});

app.patch('/api/notes/:id', (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ success: false, error: 'Note not found' });

  const title = req.body.title ?? existing.title;
  const content = req.body.content ?? existing.content;
  const pinned = req.body.pinned !== undefined ? (req.body.pinned ? 1 : 0) : existing.pinned;

  db.prepare(`
    UPDATE notes
    SET title = ?, content = ?, pinned = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `).run(title, content, pinned, id);

  const updated = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
  res.json({ success: true, data: updated });
});

app.delete('/api/notes/:id', (req, res) => {
  db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// 9. API Request Proxy / Mini-Postman Client
app.post('/api/proxy/request', requireAuth, limitProxy, async (req, res) => {
  const { url, method = 'GET', headers = {}, body = null } = req.body;
  if (!url) return res.status(400).json({ success: false, error: 'URL is required' });

  // P0 SSRF guard: only http/https, block cloud metadata IP
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid URL' });
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ success: false, error: 'Only http/https URLs are allowed' });
  }
  if (parsed.hostname === '169.254.169.254' || parsed.hostname === 'metadata.google.internal') {
    return res.status(403).json({ success: false, error: 'Cloud metadata endpoints are blocked' });
  }
  const upperMethod = String(method).toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(upperMethod)) {
    return res.status(400).json({ success: false, error: 'Unsupported HTTP method' });
  }

  const startTime = Date.now();
  try {
    const fetchOptions = {
      method: upperMethod,
      headers: {
        'User-Agent': 'AetherDesk-Client/1.0',
        ...headers,
      },
      signal: AbortSignal.timeout(10000),
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(upperMethod)) {
      const bodyStr = typeof body === 'object' ? JSON.stringify(body) : String(body);
      if (bodyStr.length > 200000) {
        return res.status(400).json({ success: false, error: 'Request body too large (max 200KB)' });
      }
      fetchOptions.body = bodyStr;
    }

    const response = await fetch(url, fetchOptions);
    const durationMs = Date.now() - startTime;
    const respHeaders = {};
    response.headers.forEach((val, key) => { respHeaders[key] = val; });

    let data;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    res.json({
      success: true,
      status: response.status,
      statusText: response.statusText,
      durationMs,
      headers: respHeaders,
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      durationMs: Date.now() - startTime,
    });
  }
});

// Serve client production build if exists
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  // Client SPA fallback
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
      return res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    }
    next();
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🌌 [AetherDesk Core] Service listening on http://0.0.0.0:${PORT}`);
  console.log(`📡 WebSocket Telemetry stream at ws://localhost:${PORT}/ws`);
  console.log(`🎣 Webhook Catcher ready at http://localhost:${PORT}/api/webhooks/catch/:token\n`);
});

// Graceful shutdown for daemon restarts / systemd / container stops
function gracefulShutdown(signal) {
  console.log(`\n🛑 [AetherDesk] Received ${signal}, shutting down...`);
  clearInterval(telemetryInterval);
  wss.close(() => {
    server.close(() => {
      try { db.close(); } catch (_) {}
      console.log('✅ [AetherDesk] Closed cleanly.');
      process.exit(0);
    });
    // Force exit if connections hang
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
