# Plan: Dashboard Shell

**Spec:** @docs/specs/systems/nexus-dashboard/dashboard-shell.md
**Status:** In Progress
**Started:** 2026-04-27
**Last Updated:** 2026-04-27

## Implementation Patterns

### Server (packages/dashboard)
- **Framework:** Hono — lightweight, TypeScript-native, `@hono/node-server` adapter
- **Static serving:** Hono `serveStatic` middleware for built frontend assets
- **SPA fallback:** Non-API, non-asset routes serve `index.html`
- **Process management:** Foreground by default; background via `child_process.spawn` with `detached: true`
- **PID file:** `~/.nexus/dashboard.pid` for background mode

### Data Polling Layer
- **Pattern:** `DataCache` class with `startPolling()` / `stopPolling()` / `getData()` / `getSummary()`
- **File I/O:** Uses `@nexus/shared` JSONL utilities (readJsonlFile, parseJsonlLine)
- **mtime check:** `fs.stat()` before re-reading; `fileMtimes` map tracks last-seen mtime per path
- **Deduplication:** Generic `deduplicateRecords<T extends { id: string }>()` — group by ID, take last
- **Event files:** Read today's event file; historical on request via date range query params
- **Graceful missing files:** `ENOENT` → empty array, not crash

### Frontend (React SPA)
- **Framework:** React 19 with TypeScript, built by Vite
- **Styling:** Tailwind CSS 4, dark theme default
- **Routing:** React Router for client-side navigation
- **Data fetching:** `fetch('/api/data')` and `fetch('/api/summary')` on interval, React Context for state
- **Build output:** `packages/dashboard/dist/public/` — served by Hono as static files

### View Registry
- **Pattern:** Simple typed array, imported at build time (no dynamic plugin system)
- **Interface:** `DashboardView { id, label, route, icon, component, order }`
- **Registration:** `registerView()` / `getRegisteredViews()` functions
- **Wiring:** Shell reads registry → renders nav + routes

### CLI Launcher (packages/core)
- **Command:** `nexus dashboard [start|stop|status]`
- **Mechanism:** Core spawns the dashboard server process; dashboard package exports `startServer()`
- **Background:** `child_process.spawn` with `detached: true, stdio: 'ignore'`, writes PID file

## Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Install dependencies — Hono, React, Vite, Tailwind, React Router | Done | |
| 2 | Data Polling Layer — DataCache, mtime check, dedup, polling timer | Done | data.ts |
| 3 | HTTP Server — Hono app, API routes (/api/data, /api/summary), static serving | Done | app.ts, server.ts |
| 4 | Frontend scaffold — Vite + React + Tailwind setup, build config | Done | vite.config.ts, Tailwind 4 |
| 5 | Application Layout — Shell component, header, sidebar, status bar | Done | Shell.tsx |
| 6 | View Registry — register/get, wire to router and nav | Done | registry.ts |
| 7 | Overview Page — built-in dashboard view with summary cards | Done | views/Overview.tsx |
| 8 | Global Project Filter — header dropdown, URL persistence, API wiring | Done | In Shell header + API query params |
| 9 | CLI Launcher — nexus dashboard start/stop/status commands | Done | core/cli/dashboard.ts |
| 10 | Tests — server, data layer, components | Done | 15 tests (data.test.ts + app.test.ts) |

## Session Notes

### 2026-04-27
- All 6 Dashboard Shell feature specs read and analyzed
- Plan created, starting implementation
- All tasks completed: server (Hono + data polling), frontend (React + Tailwind + Vite), CLI launcher
- 150 total tests passing (135 existing + 15 new dashboard tests)
- Sessions, Events, and Worktrees views implemented alongside Overview
