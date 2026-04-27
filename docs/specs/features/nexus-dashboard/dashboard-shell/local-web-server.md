# Feature Spec: Local Web Server

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Dashboard | @docs/specs/applications/nexus-dashboard.md |
| System | Dashboard Shell | @docs/specs/systems/nexus-dashboard/dashboard-shell.md |

## Problem Statement

The Dashboard needs a local HTTP server to serve the SPA frontend and expose a JSON data API on localhost.

## Acceptance Criteria

- [ ] HTTP server starts on `localhost:<port>` (default 3000)
- [ ] Serves static SPA assets (HTML, JS, CSS) from a build directory
- [ ] Exposes `GET /api/data` returning `DashboardData` JSON
- [ ] Exposes `GET /api/summary` returning `DashboardSummary` JSON
- [ ] Port fallback: if default port is in use, try next 5 ports (3001-3005)
- [ ] Binds to `localhost` only — no external access (per PD-003)
- [ ] Configurable via `~/.nexus/config.json` (`dashboard.port`)
- [ ] Logs startup message: "Nexus Dashboard running at http://localhost:<port>"
- [ ] Opens browser on start (configurable, default true)

## Data Models / API

### Endpoints

```
GET /                    → index.html (SPA entry point)
GET /assets/*            → Static JS/CSS/images
GET /api/data            → DashboardData JSON
  ?project=<path>        → Filter by project
  ?eventsFrom=<iso>      → Events start date
  ?eventsTo=<iso>        → Events end date
GET /api/summary         → DashboardSummary JSON
  ?project=<path>        → Filter by project
```

### Response Types

```typescript
interface DashboardData {
  events: NexusEvent[];
  sessions: SessionRecord[];
  worktrees: WorktreeRecord[];
  projects: string[];
  lastUpdated: string;
}

interface DashboardSummary {
  activeSessions: number;
  activeWorktrees: number;
  eventsToday: number;
  staleSessions: number;
  conflictedWorktrees: number;
  lastUpdated: string;
}
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Set up `packages/dashboard` package (package.json, tsconfig) | Not Started |
| 2 | Implement HTTP server with static file serving and API routes | Not Started |
| 3 | Implement port detection and fallback logic | Not Started |
| 4 | Implement browser auto-open on startup | Not Started |
| 5 | Add config loading for port, open-on-start settings | Not Started |
| 6 | Add tests: server start, port fallback, API responses, config override | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Server written in TypeScript |
| PD-003 | Local-only deployment | Binds to `localhost` only |
| PD-006 | Core and Dashboard separate | No Core imports; reads files via shared utilities |
| PD-007 | Centralized storage in `~/.nexus/` | Reads data from `~/.nexus/` |
| DD-001 | Dashboard is read-only | API endpoints are all GET (read-only) |
| DD-003 | Direct JSONL file reads | Server reads JSONL files directly |
| DS-001 | Server-side polling with cache | Server caches parsed data; API serves from cache |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Framework | Which HTTP framework — Express, Fastify, or Hono? | Hono — lightweight, fast, TypeScript-native, minimal dependencies. Express is heavier than needed; Fastify is great but more boilerplate. | Hono. Lightest option, TypeScript-native, zero-config. |
| 2 | SPA Routing | How to handle SPA client-side routes (e.g., `/sessions/abc`)? | Fallback: any non-API, non-asset route serves `index.html`. Client-side router takes over. | Standard SPA fallback. Non-API/asset routes → `index.html`. |

## Status

`Approved`
