# Application Spec: Nexus Core

## Parent Platform

@docs/specs/platform/PLATFORM.md

## Purpose

Nexus Core is the CLI and orchestration engine for the Nexus platform. It provides the foundational infrastructure that gives developers visibility into, control over, and coordination between multiple CLI-LLM agent sessions working across multiple projects on the same machine.

Core is a **global orchestrator** — it tracks every agent action across all projects (audit trail), prevents agents from colliding (worktree isolation), and maintains the identity and lineage of every session (session registry). All data is stored centrally in `~/.nexus/` with a `project` field for filtering. It exposes its data via files and APIs that the Nexus Dashboard and future systems consume.

**For:** Developers running multiple CLI-LLM agents (Claude Code, Cursor, Aider, etc.) across multiple projects who need a single pane of glass for what's happening.

## Systems

### Phase 1 — Infrastructure Layer

| System | Description | Spec | Status |
|--------|-------------|------|--------|
| Audit Trail | Append-only structured event log capturing every significant action across all systems | @docs/specs/systems/nexus-core/audit-trail.md | Done |
| Worktree Isolation | Git worktree manager that automatically isolates concurrent agent tasks and detects file-level conflicts | @docs/specs/systems/nexus-core/worktree-isolation.md | Done |
| Session Registry | Tracks every agent session — identity, parent lineage, state snapshots, and lifecycle | @docs/specs/systems/nexus-core/session-registry.md | Done |

### Phase 1.5 — Integration Layer

| System | Description | Spec | Status |
|--------|-------------|------|--------|
| Agent Adapter | Wraps CLI-LLM agent invocations — registers sessions, creates worktrees, emits audit events, cleans up on completion. Agent-agnostic interface with Claude Code as first integration | @docs/specs/systems/nexus-core/agent-adapter.md | Done |

### Phase 2 — Control Layer (Future)

| System | Description | Spec | Status |
|--------|-------------|------|--------|
| Budget & Token Metering | Per-task token tracking, cost metering, and budget enforcement (soft/hard caps) | TBD | Planned |
| Approval Policy Engine | Rule-based decision routing — auto-approve routine actions, queue critical ones for human review | TBD | Planned |
| Spec & Backlog Manager | Structured ideation backlog with lifecycle tracking for specs and research items | TBD | Planned |

## Application-Specific Architecture

### Data Flow

```
Agent Session
    │
    ├── Worktree Isolation ──→ Creates/manages git worktrees per task
    │
    ├── Session Registry ────→ Assigns session ID, tracks lineage and state
    │
    └── Audit Trail ─────────→ Captures all events from all systems
                                    │
                                    ▼
                              JSONL event files ←── consumed by Dashboard
```

### Storage Layout

```
~/.nexus/                        # Centralized Nexus data directory (user home)
├── events/                      # Audit trail event logs (all projects)
│   ├── events-2026-04-26.jsonl  # Daily rotated event files
│   └── ...
├── sessions/                    # Session registry (all projects)
│   └── sessions.jsonl           # Session records
├── worktrees/                   # Worktree metadata (not the worktrees themselves)
│   └── worktrees.jsonl          # Active/completed worktree records
├── projects.json                # Registry of tracked projects
└── config.json                  # Nexus configuration
```

All records include a `project` field (resolved project path) for filtering by project.

### Key Patterns

- **Append-only writes** — events and session records are only ever appended, never modified in place
- **Correlation by session ID** — every event, worktree, and action references a session ID for traceability
- **File-based atomic writes** — write to temp file, then rename, to prevent partial writes
- **Daily rotation** — event logs rotate daily to keep individual files manageable
- **CLI-first interface** — all operations available via CLI commands; no GUI required

### Agent Adapter Model

Core does not modify agents. Instead, it wraps agent invocations:

1. **Before agent starts:** Create worktree, register session, log start event
2. **During execution:** Monitor for context health, track token usage (where observable)
3. **After agent completes:** Merge worktree, update session status, log completion event

The adapter is agent-agnostic at the interface level, with optional agent-specific enrichment (e.g., Claude Code exposes more metrics than others).

## Platform Dependencies

| Shared Module | What Core Uses |
|---------------|----------------|
| `packages/shared` — Event schema | TypeScript types for all event kinds; shared between Core (producer) and Dashboard (consumer) |
| `packages/shared` — Session types | Session data model; shared between Core (producer) and Dashboard (consumer) |
| `packages/shared` — Config loader | JSON config file reading/validation |
| `packages/shared` — JSONL utilities | Append, read, rotate, and query JSONL files |

## Out of Scope

- **No visual UI** — that's Nexus Dashboard's responsibility
- **No cloud/remote deployment** — local-only for v1 (per PD-003)
- **No database** — file-based storage only for v1 (per PD-002)
- **No direct agent modification** — Nexus wraps/observes agents, does not patch or fork them
- **No multi-human support in v1** — architecture supports it, but implementation is deferred (per PD-003)

## Inherited Binding Decisions

| Decision ID | Summary | How This Application Complies |
|-------------|---------|-------------------------------|
| PD-001 | TypeScript as the sole language | Core is written entirely in TypeScript, running on Node.js |
| PD-002 | File-based storage (JSONL/JSON) | All data stored in `~/.nexus/` directory as JSONL event streams and JSON config |
| PD-003 | Local-only deployment for v1 | Core runs as a local CLI tool; no network services required. Session model includes user_id field to support future multi-human |
| PD-004 | Append-only event log pattern | Audit Trail system implements this directly; all other systems emit into it |
| PD-005 | Git worktree for change isolation | Worktree Isolation system implements this directly |
| PD-006 | Core and Dashboard are separate applications | Core exposes data via files and future APIs; does not include any visual layer |

## Decisions

| ID | Decision | Rationale | Scope | Status | Binding |
|----|----------|-----------|-------|--------|---------|
| CD-001 | Centralized `~/.nexus/` directory in user home for all data | Nexus is a global orchestrator across projects; centralized storage provides unified view; all records include `project` field for filtering | Application | Accepted | Yes |
| CD-002 | Daily rotation for event log files | Keeps individual files manageable; simplifies retention (delete files older than 90 days) | Application | Accepted | Yes |
| CD-003 | Agent-agnostic adapter interface | Common interface for all agents (start/stop/status); optional enrichment plugins per agent type | Application | Accepted | Yes |
| CD-004 | CLI-first interface | All operations must be available via CLI commands; no operation requires a GUI | Application | Accepted | Yes |

## AI Review Questions

| # | Section | Question | Answer |
|---|---------|----------|--------|
| 1 | Storage | Where does Nexus store its data? | Centralized in `~/.nexus/` (user home). Nexus is a global orchestrator across projects, so data is not per-project. All records include a `project` field for filtering. No gitignore needed since data is outside project directories. |
| 2 | Architecture | How does Core handle agent crashes mid-session? Worktree may be dirty, session left in "running" state. | Session registry needs a health check / stale session detector. On startup, Core scans for sessions marked "running" that have no live process, and marks them as "interrupted." Worktree cleanup is offered, not forced. |
| 3 | Agent Adapter | What's the minimum an adapter must report? Not all agents expose the same data. | Minimum: session start, session end, exit status. Optional: token count, files changed, commits made. The event schema uses optional fields for enrichment. |
| 4 | Concurrency | What if two Nexus Core instances run simultaneously? | File-based locking on `~/.nexus/nexus.lock`. Second instance warns and exits, or runs read-only. Detail in system specs. |
| 5 | Data Growth | With active use, `.nexus/events/` could grow significantly. Is rotation + 90-day archival sufficient? | For local single-developer use, yes. At ~1KB per event and ~1000 events/day, that's ~90MB for 90 days. Comfortable for local storage. |
| 6 | Scope | Phase 2 systems (Budget, Approval, Backlog) are listed but unspecced. Should they be removed until ready? | Keep them listed as "Planned" for roadmap visibility. They inform architectural choices in Phase 1 (e.g., event schema should be extensible for budget events). |

## Status

`Active`
