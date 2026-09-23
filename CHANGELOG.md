# Changelog

## 2.3.0 — Backup pomodoro_logs + parallel tests
- Backup export/import includes `pomodoro_logs` (transactional replace; invalid rows skipped)
- `pnpm test` no longer forces `--test-concurrency=1` (suites use isolated `AETHER_DB_PATH`)
- Docs: README backup section + this changelog

## 2.2.0 — Test DB isolation
- `AETHER_DB_PATH` for configurable SQLite path; auth/smoke suites use separate DBs

## 2.1.0 — Auth smoke + runtime meta + repo polish
- `GET /api/meta` (version, authRequired, webhook retention); Sidebar footer meta + i18n
- Auth regression suite (open-mode + token mode 401/200)
- CONTRIBUTING, PR/Issue templates; README CI badge + AI authorship note; author → Seamain

## 2.0.0 — Backup & Restore release
- Backup export/import (`GET/POST /api/backup/*`, Sidebar one-click download/restore, transactional replace of tasks/snippets/scripts/notes)
- Version bumped to 2.0.0 across root, client, HUD badge, and backup payloads

## 1.9 — Frontend resilience
- Per-tab `ErrorBoundary` with localized fallback; 401 dispatches `aether:unauthorized` → dismissible token banner

## 1.8 — Tunable webhook retention
- `WEBHOOK_KEEP` / `WEBHOOK_TTL_DAYS` env (defaults 200 / 7), bound SQL params, verified live

## 1.7 — API debugger history
- Last-20 localStorage history with click-to-refill, per-item delete, `api.*` i18n keys

## 1.6 — Kanban drag-and-drop
- Native HTML5 DnD across columns (steppers kept for touch), tasks CRUD smoke test (11/11)

## 1.5 — Edit everywhere
- `PATCH /api/scripts/:id`; Snippets + Automation edit modals sharing create/save flow

## 1.4 — Webhook inbox search
- `DELETE /api/webhooks/:id`, search box, topic pills, per-event delete synced with WS state

## 1.3 — Auth UX, Docker, tests
- Navbar Bearer token field auto-attached by `api.ts`; `Dockerfile` + compose + healthcheck; `node:test` smoke suite + CI

## 1.2 — Hardening + i18n foundation
- Optional `AETHER_TOKEN` auth, sliding-window rate limits, SSRF proxy guards, input clamps, graceful shutdown
- `zh` / `en` dictionaries, persisted language

## 1.1 — Notes + mobile + Focus fix
- Notes view resurrection (backend already existed), mobile bottom nav, Focus drift fix + custom 1–180 min timer, null-safe date rendering

## 1.0 — Initial cockpit
- Telemetry HUD, Kanban, Focus presets, Runner sandbox, Snippets, Webhooks, Automation, HTTP debugger, SQLite WAL store
