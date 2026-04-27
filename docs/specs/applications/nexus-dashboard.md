# Application Spec: Nexus Dashboard

## Parent Platform

@docs/specs/platform/PLATFORM.md

## Purpose

Nexus Dashboard is a local web application that provides a visual layer over Nexus Core's data. It reads the JSONL files that Core produces and renders them as interactive views — active sessions, event timelines, worktree status, and lineage trees — all in one place on `localhost`.

Dashboard is **read-only**. It does not create sessions, worktrees, or events. It is a consumer of Core's data, not an operator. This clean separation (PD-006) means Core can evolve without Dashboard changes, and Dashboard can be redesigned without touching the engine.

**For:** Developers running Nexus Core who want to *see* what's happening across their agent sessions and projects rather than querying via CLI.

## Systems

| System | Description | Spec | Status |
|--------|-------------|------|--------|
| Dashboard Shell | Local web server, application layout, navigation, near-real-time data refresh | @docs/specs/systems/nexus-dashboard/dashboard-shell.md | Planned |
| Session Views | Session list, detail drilldown, lineage tree visualisation, status filtering | @docs/specs/systems/nexus-dashboard/session-views.md | Planned |
| Event Timeline | Chronological event stream with filtering by project, session, agent, event type, and time range | @docs/specs/systems/nexus-dashboard/event-timeline.md | Planned |
| Worktree Status | Active worktrees per project, conflict indicators, merge status, stale worktree warnings | @docs/specs/systems/nexus-dashboard/worktree-status.md | Planned |

## Application-Specific Architecture

### Data Flow

```
~/.nexus/events/*.jsonl ──┐
~/.nexus/sessions/*.jsonl ─┼──→ Dashboard Server (localhost) ──→ Browser UI
~/.nexus/worktrees/*.jsonl ┘         │
                                     ├── Serves static frontend assets
                                     ├── Reads JSONL files on request
                                     └── Pushes updates via polling or WebSocket
```

### Data Access Model

Dashboard reads Core's JSONL files directly from `~/.nexus/`. It does **not** go through a Core API — there isn't one in v1. This is the simplest possible integration: shared file format, shared types, no network protocol.

```
packages/shared/          # Shared TypeScript types
├── events.ts             # NexusEvent type — Core writes, Dashboard reads
├── sessions.ts           # SessionRecord type — Core writes, Dashboard reads
├── worktrees.ts          # WorktreeRecord type — Core writes, Dashboard reads
└── jsonl.ts              # JSONL read utilities — used by both
```

### Update Model

Dashboard refreshes data by polling the JSONL files at a configurable interval (default: 5 seconds). This is simpler than WebSocket for v1 and meets the platform NFR of "updates within 10 seconds."

Future option: Core could emit filesystem events (via `fs.watch`) that Dashboard listens to for instant updates.

### Key Patterns

- **Read-only** — Dashboard never writes to `~/.nexus/`; all mutation goes through Core CLI
- **File-based data access** — reads JSONL directly, no API layer in v1
- **Polling refresh** — configurable interval, default 5 seconds
- **Server-rendered or SPA** — to be decided in system specs; either works since it's local-only
- **Desktop browser only** — no mobile/responsive for v1

### Page Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  Nexus Dashboard                            [Project Filter ▼]  │
├────────┬────────────────────────────────────────────────────────┤
│        │                                                        │
│  Nav   │  Main Content Area                                     │
│        │                                                        │
│  ○ Overview   │  (varies by selected view)                      │
│  ○ Sessions   │                                                 │
│  ○ Events     │                                                 │
│  ○ Worktrees  │                                                 │
│        │                                                        │
├────────┴────────────────────────────────────────────────────────┤
│  Status Bar: 3 active sessions │ 2 worktrees │ Last update: 5s │
└─────────────────────────────────────────────────────────────────┘
```

**Views:**

1. **Overview** — summary panel: active session count, recent events, worktree status, per-project breakdown
2. **Sessions** — session list with status filtering, click to drilldown into detail + lineage tree
3. **Events** — chronological event stream with filters (project, session, agent, type, time range)
4. **Worktrees** — active worktrees grouped by project, conflict indicators, merge/stale status

## Platform Dependencies

| Shared Module | What Dashboard Uses |
|---------------|---------------------|
| `packages/shared` — Event schema | `NexusEvent` type for reading and rendering events |
| `packages/shared` — Session types | `SessionRecord`, `SessionSnapshot`, `SessionLineage` types |
| `packages/shared` — Worktree types | `WorktreeRecord`, `ConflictReport` types |
| `packages/shared` — JSONL utilities | `readJsonl()`, `queryJsonl()` for reading Core's data files |
| `packages/shared` — Config loader | Read `~/.nexus/config.json` for Nexus settings |

## Out of Scope

- **No write operations** — Dashboard is read-only; all mutations go through Nexus Core CLI
- **No cloud hosting** — local web server only (`localhost`)
- **No authentication** — single user, local machine; no login, no access control
- **No mobile/responsive** — desktop browser only for v1
- **No real-time WebSocket in v1** — polling is sufficient; WebSocket is a future enhancement

## Inherited Binding Decisions

| Decision ID | Summary | How This Application Complies |
|-------------|---------|-------------------------------|
| PD-001 | TypeScript as the sole language | Dashboard server and frontend both written in TypeScript |
| PD-002 | File-based storage (JSONL/JSON) | Dashboard reads Core's JSONL files directly; no database |
| PD-003 | Local-only deployment for v1 | Serves on `localhost` only; no remote access |
| PD-004 | Append-only event log pattern | Dashboard reads the append-only event log; never writes to it |
| PD-005 | Git worktree for change isolation | N/A — Dashboard does not perform git operations; it reads worktree metadata |
| PD-006 | Core and Dashboard are separate applications | Dashboard is a separate app that reads Core's files; no shared runtime, no direct imports from Core |
| PD-007 | Centralized storage in `~/.nexus/` | Dashboard reads from `~/.nexus/` — same centralized location Core writes to |

## Decisions

| ID | Decision | Rationale | Scope | Status | Binding |
|----|----------|-----------|-------|--------|---------|
| DD-001 | Dashboard is strictly read-only | Clean separation from Core (PD-006); prevents Dashboard bugs from corrupting orchestration data; all mutations via CLI | Application | Accepted | Yes |
| DD-002 | Polling-based refresh for v1 (default 5 seconds) | Simpler than WebSocket; meets the 10-second NFR; configurable interval; WebSocket is a future upgrade path | Application | Accepted | No |
| DD-003 | Direct JSONL file reads, no Core API | Simplest integration; Core and Dashboard share types via `packages/shared`; no serialization boundary or network protocol needed for local-only v1 | Application | Accepted | Yes |
| DD-004 | Global project filter in the header | Every view can be filtered by project; default shows all projects; filter state persists across view navigation | Application | Accepted | Yes |

## AI Review Questions

| # | Section | Question | Answer |
|---|---------|----------|--------|
| 1 | Data Access | What if Core is writing to a JSONL file while Dashboard is reading it? Could Dashboard see a partial line? | JSONL append writes are atomic at the OS level for lines under the filesystem block size (~4KB). Events are single-line JSON well under this limit. Partial reads are extremely unlikely but the JSONL reader already skips malformed lines (AT-002). |
| 2 | Performance | Polling all JSONL files every 5 seconds — will this be slow with 90 days of event files? | Dashboard should only read today's file for the event timeline (or files within the visible time range). Session and worktree files are single files that grow slowly. Lazy loading and pagination handle scale. |
| 3 | Frontend | SPA (React/Svelte) or server-rendered pages? | To be decided in Dashboard Shell system spec. SPA gives better interactivity (filters, drilldowns, live updates). Server-rendered is simpler. Leaning SPA given "visual-first" philosophy. |
| 4 | Lineage Visualisation | Session lineage trees could be complex. What's the rendering approach? | Tree or DAG rendering library (e.g., D3, dagre, elkjs). Max depth of 20 (from SR AI Q2). Collapse branches beyond depth 3 by default. Detail in Session Views system spec. |
| 5 | Offline | What if Dashboard starts but Core has never run (no `~/.nexus/` directory)? | Show an empty state with instructions: "No Nexus data found. Run `nexus init` to get started." Don't crash on missing files. |
| 6 | Browser Support | Which browsers need to be supported? | Modern evergreen browsers only (Chrome, Firefox, Edge). No IE, no Safari polyfills. Local tool, user controls the browser. |

## Status

`Approved`
