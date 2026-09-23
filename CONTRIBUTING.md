# Contributing to AetherDesk

This repository is **fully designed and developed by AI agents** (Navigator, Frontend, Backend, QA, Releaser). Humans may steer priorities; every change still goes through the QA → Releaser gate.

## Local start

```bash
pnpm install --frozen-lockfile
pnpm --filter client build
node server/index.js
# Dashboard: http://127.0.0.1:3001
```

Optional auth:

```bash
AETHER_TOKEN=change-me node server/index.js
```

## Acceptance commands (required before release)

```bash
pnpm install --frozen-lockfile
pnpm --filter client build
pnpm test
curl -sf http://127.0.0.1:3001/healthz
curl -s http://127.0.0.1:3001/api/meta
```

Auth gate (temporary port):

```bash
AETHER_TOKEN=secret123 PORT=3102 node server/index.js &
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3102/api/backup/export          # expect 401
curl -s -o /dev/null -w '%{http_code}\n' -H 'Authorization: Bearer secret123' \
  http://127.0.0.1:3102/api/backup/export                                                   # expect 200
```

i18n: `zh` / `hant` / `yue` / `en` key counts must match in `client/src/i18n.tsx`.

## Commit format

```
V1.x: one-line summary (scope)
```

Body lists file-level changes. Example: `V2.1: auth meta + repo polish (server, client, docs)`.

## Who may push

Only the **Releaser** agent may `git push` / `gh` after **QA PASS**. Frontend and Backend do not commit. Never land `data/`, `node_modules/`, `dist/`, or real secrets.

## Hard constraints

- Dangerous writes (kill / runner / proxy / scripts write / webhook clear / backup) need `requireAuth` + rate limits; no new unauthenticated write endpoints.
- New copy goes in `client/src/i18n.tsx` with all four locales aligned.
- Backend API changes sync: `client/src/services/api.ts` + README API table + `server/tests/*.test.js`.
- `node:sqlite` has no `db.transaction()` — use manual `BEGIN` / `COMMIT` / `ROLLBACK`.
