# 🌌 AetherDesk
> **Local-first Linux developer workstation & system telemetry HUD**
> *Next-generation developer cockpit for Linux power users — Kanban, sandbox, snippets, notes, webhooks, automation, and focus timer in one dashboard.*

[![License: MIT](https://img.shields.io/badge/License-MIT-indigo.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v24.x-emerald.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-v19.x-blue.svg)](https://react.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-Native_WAL-amber.svg)](https://sqlite.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v4.x-cyan.svg)](https://tailwindcss.com/)

---

## 💡 Concept & Vision

As a developer on Linux and modern tiling desktops (e.g. **Omarchy / Hyprland**), daily work means constantly switching between terminal monitoring, task tracking, throwaway code experiments, snippet lookup, webhook debugging, API testing, and Pomodoro timing. Existing tools are either bloated, fragmented, or depend on cloud services.

**AetherDesk** is the answer: a **fully local, zero-cloud-dependency, millisecond-responsive, all-in-one** geek workstation.

- **Native telemetry**: reads the Linux `/proc` filesystem directly — CPU, memory, network, and disk metrics with no heavyweight agents.
- **Native storage**: uses Node.js 24's built-in `node:sqlite` (WAL mode) — no C++ extensions to compile, single-file persistence.
- **Native sound**: focus ambience (white/pink noise, rain) synthesized with the browser-native **Web Audio API** — no audio assets to download.
- **One cockpit**: board, sandbox, vault, webhook inbox, and ops automation in a single panel.
- **Four locales**: Simplified Chinese, Traditional Chinese, Cantonese, and English, switchable from the navbar and persisted locally.

---

## 🚀 Feature Matrix

### 1. 📊 System Telemetry HUD
- **Live CPU load & sparklines**: rolling trend charts plus a per-core usage matrix.
- **Memory & swap breakdown**: used, available, buffers, and cached memory.
- **Network throughput**: per-second RX/TX rates (KB/s, MB/s) sampled from `/proc/net/dev`.
- **Disk storage**: root mount capacity, used/available space with progress bars.
- **Top processes table**: highest CPU/memory processes with name/PID filtering and one-click kill (auth-protected when a token is set).

### 2. 📋 Kanban Task Board
- Four agile columns: **To Do**, **In Progress**, **In Review**, **Done**.
- Cards support priority (Urgent / High / Medium / Low), category, and timestamps.
- One-click cross-column moves; everything persists to local SQLite and broadcasts over WebSocket.

### 3. ⏱️ Focus Pomodoro Engine
- Circular SVG countdown with **25m focus**, **5m short break**, **15m long rest** presets plus a **custom 1–180 minute** timer.
- Drift-resistant timing (deadline-based, survives background throttling and note typing).
- **Procedural ambience (Web Audio API)**: white noise, pink noise, synthesized rain, click/success/completion chimes.
- Daily session count and total focus minutes logged automatically.

### 4. ⚡ Code Runner Sandbox
- Write and execute code right in the dashboard:
  - **Bash (Shell)**
  - **Python 3**
  - **JavaScript (Node.js)**
- One-click preset templates (Linux health check, Python env probe, Node benchmark, route diagnostics).
- Captured stdout/stderr, millisecond timing, exit codes, one-click copy. Code capped at 50 KB, execution timeout clamped to 1–30 s.

### 5. 💾 Snippets Vault
- Collect and retrieve Docker, Git, Shell, Python, and config cheats.
- Star favorites, tag filtering, instant search, one-click clipboard copy.

### 6. 🗒️ Geek Notes
- Pinned notes with full-text search, pin/unpin, inline edit modal, and copy support — backed by the same local SQLite store.

### 7. 📡 Live Webhook Inbox
- Public listener at `http://localhost:3001/api/webhooks/catch/:topic` for any HTTP method.
- Auto-generated `curl` test command; arrivals broadcast over WebSocket with an alert chime and formatted headers/query/payload inspector.
- Automatic retention: keeps the latest 200 events, drops anything older than 7 days.

### 8. 🚀 Automation Workflows
- Built-in ops scripts: memory/cache status, disk diagnosis, connection stats, top CPU processes, Git workspace summary.
- Add custom Bash commands and run them with one click; stdout/stderr shown in-console.

### 9. 🌐 HTTP Debugger
- Lightweight Postman/Insomnia alternative: GET, POST, PUT, PATCH, DELETE.
- Custom headers and JSON bodies; shows status code, duration (ms), response headers, and formatted data. Server-side SSRF guardrails (http/https only, metadata-IP block, 10 s timeout).

---

## 🛠️ Architecture

```
                        ┌─────────────────────────────────────┐
                        │          AetherDesk Web HUD         │
                        │   React 19 + TypeScript + Tailwind  │
                        │      Vite + Lucide + Web Audio      │
                        │        4 locales (i18n.tsx)         │
                        └──────────────────┬──────────────────┘
                                           │
                         WebSocket (/ws)   │   REST API (/api/*)
                      (Live Telemetry/Push)│  (CRUD / Runner / Webhook)
                                           │
                        ┌──────────────────┴──────────────────┐
                        │          AetherDesk Core            │
                        │     Node.js 24 (ESM Native)         │
                        ├──────────────────┬──────────────────┤
                        │  System Reader   │  Script Runner   │
                        │  (/proc & Linux) │ (Bash / Py / JS) │
                        ├──────────────────┴──────────────────┤
                        │          SQLite Engine              │
                        │  (node:sqlite WAL Concurrent DB)    │
                        └─────────────────────────────────────┘
```

| Layer | Location | Notes |
| :--- | :--- | :--- |
| Frontend | `client/src/` — 9 views, `i18n.tsx`, `services/api.ts` (+Bearer) | Vite build served by Express; mobile bottom nav |
| Backend | `server/index.js` (+ `system.js`, `runner.js`, `db.js`) | Express + `ws`; `/healthz`, auth, rate limits, graceful shutdown |
| Storage | `data/aetherdesk.db` | Tables: `tasks`, `snippets`, `scripts`, `webhooks`, `pomodoro_logs`, `notes` |
| Ops | `start.sh`, `daemon.sh`, `Dockerfile`, `docker-compose.yml` | Foreground / daemon / container modes |

---

## 📦 Getting Started

### Prerequisites
- **Linux** (Arch, Ubuntu, Debian, Fedora, Omarchy, …)
- **Node.js** >= 22 (24+ recommended — ships `node:sqlite` natively)
- **pnpm** (managed via `corepack`, pinned in `packageManager`)

### Quick start
```bash
# Foreground (builds the frontend on first run if needed)
./start.sh

# Or background daemon: start | stop | restart | status | logs
./daemon.sh start
```

You get:
- 🌐 Dashboard: **`http://localhost:3001`**
- 📡 WebSocket telemetry: **`ws://localhost:3001/ws`** (pushed every 1200 ms)
- 🎣 Webhook gateway: **`http://localhost:3001/api/webhooks/catch/my-service`**
- ❤️ Health checks: **`GET /healthz`** and **`GET /api/health`**

### Development (hot reload)
```bash
pnpm dev:server   # backend with --watch
pnpm dev:client   # Vite HMR (proxies /api and /ws to :3001)
```

### Auth (optional Bearer token)
When `AETHER_TOKEN` is set, dangerous endpoints (kill-process, runner, proxy, script create/run/delete, webhook clear) require `Authorization: Bearer <token>`. Enter it once in the lock-field in the navbar — it's stored in `localStorage` and attached automatically.

```bash
AETHER_TOKEN="change-me" ./daemon.sh restart
```

Built-in guardrails always apply: process list capped at 50, runner code ≤ 50 KB with 1–30 s timeout, proxy body ≤ 200 KB with 10 s timeout, and per-minute rate limits (runner 10, proxy 30, webhook-catch 120, kill 10).

### Docker
```bash
docker compose up -d --build
curl http://localhost:3001/healthz
```

### Tests
```bash
pnpm test   # node:test backend smoke suite: health, telemetry, clamps, SSRF blocks, runner, webhooks
```

---

## 🔌 API Reference

| Proto | Path | Notes |
| :--- | :--- | :--- |
| `WS` | `/ws` | Telemetry every 1200 ms + webhook/task broadcasts |
| `GET` | `/healthz`, `/api/health` | Liveness / readiness |
| `GET` | `/api/system/status` | Kernel, CPU, memory, network, disk snapshot |
| `GET` | `/api/system/processes?limit=15` | Top processes (limit clamped 1–50) |
| `POST` | `/api/system/kill-process` | Kill by PID 🔒 |
| `GET`/`POST` | `/api/tasks` | List / create board cards |
| `PATCH`/`DELETE` | `/api/tasks/:id` | Update / delete a card |
| `GET`/`POST` | `/api/snippets` | List / create snippets |
| `PATCH`/`DELETE` | `/api/snippets/:id` | Update / delete a snippet |
| `GET`/`POST` | `/api/notes` | List / create notes |
| `PATCH`/`DELETE` | `/api/notes/:id` | Update / delete a note |
| `GET`/`POST` | `/api/scripts` | List / create automation scripts (create 🔒) |
| `PATCH`/`DELETE` | `/api/scripts/:id` | Update / delete a script 🔒 |
| `POST` | `/api/scripts/:id/run` | Execute a script 🔒 |
| `DELETE` | `/api/scripts/:id` | Delete a script 🔒 |
| `POST` | `/api/runner/run` | Sandbox exec (bash/python/node) 🔒 |
| `GET` | `/api/webhooks` | Latest 50 captured events |
| `DELETE` | `/api/webhooks` | Clear inbox 🔒 |
| `DELETE` | `/api/webhooks/:id` | Delete one event 🔒 |
| `ALL` | `/api/webhooks/catch/:topic` | Universal webhook receiver |
| `GET` | `/api/pomodoro/stats` | Recent logs + today's totals |
| `POST` | `/api/pomodoro/log` | Log a completed session |
| `POST` | `/api/proxy/request` | Proxied HTTP debug request 🔒 |

🔒 = requires `Bearer` token when `AETHER_TOKEN` is set; always rate-limited.

---

## 📄 License

Released under the [MIT License](LICENSE). Free to use, extend, and remix!
