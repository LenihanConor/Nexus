# System Spec: Dashboard Shell

## Parent Application

@docs/specs/applications/nexus-dashboard.md

## Purpose

Dashboard Shell owns the local web server, application layout, navigation, global state (project filter), and the data polling mechanism that all view systems plug into. It is the skeleton of the Dashboard — Session Views, Event Timeline, and Worktree Status are the content rendered inside it.

It handles: starting/stopping the server, serving the frontend, reading JSONL files on a polling interval, and providing parsed data to views. Views register routes and nav items but don't manage their own data fetching or layout.

## Features

| Feature | Description | Spec | Status |
|---------|-------------|------|--------|
| Local Web Server | HTTP server on `localhost:<port>` serving frontend assets and a data API | @docs/specs/features/nexus-dashboard/dashboard-shell/local-web-server.md | Planned |
| Application Layout | Page shell with header, sidebar navigation, main content area, and status bar | @docs/specs/features/nexus-dashboard/dashboard-shell/application-layout.md | Planned |
| Data Polling Layer | Background polling of `~/.nexus/` JSONL files at configurable interval; parsed data available to all views | @docs/specs/features/nexus-dashboard/dashboard-shell/data-polling-layer.md | Planned |
| Global Project Filter | Dropdown in header to filter all views by project; default shows all; persists across navigation | @docs/specs/features/nexus-dashboard/dashboard-shell/global-project-filter.md | Planned |
| View Registry | Mechanism for view systems to register routes, nav items, and components | @docs/specs/features/nexus-dashboard/dashboard-shell/view-registry.md | Planned |
| CLI Launcher | `nexus dashboard` command to start the server; `nexus dashboard stop` to stop it | @docs/specs/features/nexus-dashboard/dashboard-shell/cli-launcher.md | Planned |

## Public Interfaces

### Server API

```typescript
// Start the dashboard server
function startDashboard(opts?: {
  port?: number;                  // Default: 3000
  pollInterval?: number;          // Milliseconds, default: 5000
  open?: boolean;                 // Open browser on start, default: true
}): void;

// Stop the dashboard server
function stopDashboard(): void;
```

### Data Layer API

The data layer polls JSONL files and exposes parsed, deduplicated data to all views:

```typescript
interface DashboardData {
  events: NexusEvent[];           // Today's events (or visible time range)
  sessions: SessionRecord[];      // Current state of all sessions (deduplicated)
  worktrees: WorktreeRecord[];    // Current state of all worktrees (deduplicated)
  projects: string[];             // List of all known projects (derived from data)
  lastUpdated: string;            // ISO 8601 timestamp of last poll
}

// Get current data snapshot (frontend calls this)
// GET /api/data?project=<path>&eventsFrom=<iso>&eventsTo=<iso>
function getData(filters?: {
  project?: string;
  eventsFrom?: string;
  eventsTo?: string;
}): DashboardData;

// Get summary counts for the status bar
// GET /api/summary?project=<path>
function getSummary(filters?: {
  project?: string;
}): DashboardSummary;

interface DashboardSummary {
  activeSessions: number;
  activeWorktrees: number;
  eventsToday: number;
  staleSessions: number;
  conflictedWorktrees: number;
  lastUpdated: string;
}
```

### View Registration Contract

Each view system registers itself with the shell:

```typescript
interface DashboardView {
  id: string;                     // Unique view ID (e.g., "sessions", "events", "worktrees")
  label: string;                  // Nav label (e.g., "Sessions")
  route: string;                  // URL path (e.g., "/sessions")
  icon?: string;                  // Nav icon identifier
  component: ComponentType;       // Frontend component to render in main content area
  order: number;                  // Nav sort order
}

function registerView(view: DashboardView): void;
```

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  Nexus Dashboard                            [Project Filter ▼]  │
├────────┬────────────────────────────────────────────────────────┤
│        │                                                        │
│  Nav   │  Main Content Area                                     │
│        │  (rendered by the active view's component)             │
│  ○ Overview   │                                                 │
│  ○ Sessions   │                                                 │
│  ○ Events     │                                                 │
│  ○ Worktrees  │                                                 │
│        │                                                        │
├────────┴────────────────────────────────────────────────────────┤
│  Status Bar: 3 active │ 2 worktrees │ 0 stale │ Updated: 5s    │
└─────────────────────────────────────────────────────────────────┘
```

### Configuration

Read from `~/.nexus/config.json`:

```typescript
interface DashboardConfig {
  dashboard?: {
    port?: number;                // Default: 3000
    pollInterval?: number;        // Milliseconds, default: 5000
    openOnStart?: boolean;        // Default: true
    defaultProject?: string;      // Default project filter (null = all)
  };
}
```

## Dependencies

| Dependency | What This System Uses |
|-----------|----------------------|
| `packages/shared` — JSONL utilities | `readJsonl()` for polling `~/.nexus/` files |
| `packages/shared` — Event schema | `NexusEvent` type for parsing events |
| `packages/shared` — Session types | `SessionRecord` type for parsing sessions |
| `packages/shared` — Worktree types | `WorktreeRecord` type for parsing worktrees |
| `packages/shared` — Config loader | Read `~/.nexus/config.json` |

No runtime dependency on Nexus Core — reads files only.

## Architecture

### Server Architecture

```
nexus dashboard (CLI)
    │
    └── HTTP Server (localhost:3000)
            │
            ├── GET /                    → Serves SPA index.html
            ├── GET /assets/*            → Serves static JS/CSS
            ├── GET /api/data            → Returns DashboardData JSON
            ├── GET /api/summary         → Returns DashboardSummary JSON
            └── GET /api/events/stream   → (future) SSE or WebSocket for real-time
```

### Data Flow

```
Polling Timer (every 5s)
    │
    ├── Read ~/.nexus/events/events-YYYY-MM-DD.jsonl ──→ parse ──→ NexusEvent[]
    ├── Read ~/.nexus/sessions/sessions.jsonl ──→ parse + deduplicate ──→ SessionRecord[]
    └── Read ~/.nexus/worktrees/worktrees.jsonl ──→ parse + deduplicate ──→ WorktreeRecord[]
            │
            └── Cache in memory ──→ serve via /api/data and /api/summary
```

### Polling Strategy

- Server-side polling: the Node.js server reads files on interval and caches results
- Frontend fetches `/api/data` on its own interval (or on navigation)
- Two-tier polling avoids the frontend reading raw files (keeps file I/O server-side)
- Cache is invalidated and refreshed every `pollInterval` milliseconds
- Only reads files that have changed (check `mtime` before re-reading)

### Deduplication

Sessions and worktrees use append-only latest-wins storage. The data layer:
1. Reads all records from the JSONL file
2. Groups by `id`
3. Takes the last record per `id` (latest write wins)
4. Returns the deduplicated list

Events are not deduplicated — they are naturally unique (each has its own `id`).

### Project Filter

- Derived from the `project` field across all loaded data
- Stored as frontend state (URL query param or localStorage)
- Passed to `/api/data?project=<path>` for server-side filtering
- Default: all projects (no filter)

### Overview Page

The Overview is built into the shell (not a separate view system). It aggregates data from all sources:

- **Active Sessions** — count + mini-list of running sessions
- **Recent Events** — last 20 events
- **Worktree Status** — count of active, conflicted, stale
- **Per-Project Breakdown** — table of projects with session/worktree/event counts

## Implementation Patterns

### Server

- Local HTTP server using a lightweight framework (Express, Fastify, or Hono)
- Static file serving for the SPA frontend build output
- JSON API endpoints for data access
- Process management: runs in foreground by default; `--background` flag for daemonization

### Frontend

- SPA framework (React, Svelte, or Preact — to be decided)
- Client-side routing for view navigation
- Fetch-based data loading from `/api/*` endpoints
- Minimal styling framework (Tailwind, CSS modules, or plain CSS)

### File I/O

- Server-side only — frontend never reads files directly
- Uses `packages/shared` JSONL utilities
- `mtime` check before re-reading to avoid unnecessary I/O
- Graceful handling of missing files (empty state, not crash)

### Startup Sequence

1. Read `~/.nexus/config.json` for dashboard settings
2. Initial data load from all JSONL files
3. Start HTTP server on configured port
4. Start polling timer
5. Open browser (if configured)
6. Log: "Nexus Dashboard running at http://localhost:3000"

## Inherited Binding Decisions

| Decision ID | Summary | How This System Complies |
|-------------|---------|--------------------------|
| PD-001 | TypeScript as the sole language | Server and frontend both TypeScript |
| PD-002 | File-based storage (JSONL/JSON) | Reads Core's JSONL files; does not use a database |
| PD-003 | Local-only deployment for v1 | Serves on `localhost` only; no remote binding |
| PD-004 | Append-only event log pattern | Reads the append-only event log; applies deduplication for sessions/worktrees |
| PD-006 | Core and Dashboard are separate apps | Dashboard Shell is a Dashboard system; no imports from Core; shared types only via `packages/shared` |
| PD-007 | Centralized storage in `~/.nexus/` | Reads all data from `~/.nexus/` |
| DD-001 | Dashboard is strictly read-only | Data layer only reads; no write endpoints |
| DD-002 | Polling-based refresh (5s default) | Server-side polling with `mtime` optimisation |
| DD-003 | Direct JSONL file reads, no Core API | Reads files directly using shared JSONL utilities |
| DD-004 | Global project filter in header | Filter state managed by shell, passed to all views and API calls |

## Decisions

| ID | Decision | Rationale | Scope | Status | Binding |
|----|----------|-----------|-------|--------|---------|
| DS-001 | Server-side polling with in-memory cache | Frontend doesn't read files; server caches parsed data; simpler security model; single point of file I/O | System | Accepted | Yes |
| DS-002 | Overview page built into the shell, not a separate view system | Overview aggregates data from all sources — it's the shell's natural responsibility; avoids a one-component system | System | Accepted | No |
| DS-003 | SPA architecture for frontend | Interactivity (filters, drilldowns, live refresh) is core to the visual-first philosophy; server-rendered would fight this at every turn | System | Accepted | Yes |
| DS-004 | `mtime` check before re-reading files | Avoids re-parsing unchanged files every poll cycle; significant I/O savings for sessions/worktrees which change less frequently than events | System | Accepted | Yes |

## AI Review Questions

| # | Section | Question | Answer |
|---|---------|----------|--------|
| 1 | Server | What if port 3000 is already in use? | Try configured port first; if taken, try next 5 ports (3001-3005); log which port was used. Config option to set a fixed port. |
| 2 | Polling | Could polling cause issues if files are very large (e.g., 90 days of sessions)? | Sessions and worktrees are single files that grow slowly — deduplication in memory is fast. Events are read per-day file, only the visible range. `mtime` check avoids unnecessary reads. |
| 3 | Frontend Framework | SPA framework hasn't been chosen. Does this need to be a binding decision? | No — it's an implementation detail within Dashboard Shell. Any modern framework works. Recommend choosing based on team familiarity. Decision can be made at implementation time. |
| 4 | View Registration | Is the view registry too much abstraction for 3-4 views? | Possibly — could start with simple route config and evolve to a registry if more views are added. Keep the interface but implement it simply (an array of view definitions). |
| 5 | Background Mode | Should `nexus dashboard` run as a background daemon or foreground process? | Default foreground (logs visible). `--background` flag for daemon mode using `child_process.spawn` with detached + stdio ignore. `nexus dashboard stop` sends SIGTERM. |
| 6 | Security | Server on localhost — any risk of other local processes hitting the API? | Low risk for single-user local tool. Any local process can hit localhost. Data is read-only and non-sensitive (session metadata, file paths). Acceptable for v1. Future: add a bearer token if needed. |

## Status

`Approved`
