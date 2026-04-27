# System Spec: Session Registry

## Parent Application

@docs/specs/applications/nexus-core.md

## Purpose

The Session Registry owns the identity and lineage of every agent session across all tracked projects. Every session gets a unique ID, an optional parent pointer (forming a tree), a project association, and state snapshots at key decision points. It is the "who is doing what, where, and how did we get here?" system.

Other systems reference session IDs as their primary correlation point — worktrees are owned by sessions, events are tagged with session IDs, and future systems (budgets, approvals) will attach to sessions. The Session Registry is the identity layer that ties everything together.

## Features

| Feature | Description | Spec | Status |
|---------|-------------|------|--------|
| Session Lifecycle | Create, update, and end sessions with structured state tracking | @docs/specs/features/nexus-core/session-registry/session-lifecycle.md | Planned |
| Session Lineage | Parent-child session tree with lineage traversal (root → leaf, leaf → root) | @docs/specs/features/nexus-core/session-registry/session-lineage.md | Planned |
| State Snapshots | Capture task progress, decisions made, and context at key moments during a session | @docs/specs/features/nexus-core/session-registry/state-snapshots.md | Planned |
| Stale Session Detection | Find sessions marked "running" whose owning process has died | @docs/specs/features/nexus-core/session-registry/stale-session-detection.md | Planned |
| CLI Commands | `nexus session list`, `nexus session show`, `nexus session lineage`, `nexus session clean` | @docs/specs/features/nexus-core/session-registry/session-cli-commands.md | Planned |

## Public Interfaces

### Session Record Schema

```typescript
interface SessionRecord {
  id: string;                     // Unique session ID (UUID v4)
  parent_id: string | null;       // Parent session (null if root)
  project: string;                // Project path (e.g., "C:/GitHub/Cluiche")
  correlation_id: string;         // Groups related sessions under one intent (defaults to own id if root)
  agent_type: string;             // Agent identifier (e.g., "claude-code", "cursor", "aider")
  agent_pid: number | null;       // OS process ID of the agent (for liveness checks)
  user_id: string;                // User who owns this session (future multi-human)
  task_description: string;       // Human-readable description of what this session is doing
  status: SessionStatus;
  created_at: string;             // ISO 8601
  updated_at: string;             // ISO 8601
  ended_at: string | null;        // ISO 8601
  exit_code: number | null;       // Agent process exit code
  duration_ms: number | null;     // Total session duration
  snapshots: SessionSnapshot[];   // State snapshots captured during the session
  metadata: Record<string, unknown>; // Agent-specific metadata (tokens used, files changed, etc.)
}

type SessionStatus =
  | "running"                     // Agent is actively working
  | "paused"                      // Session paused (user-initiated or budget hold)
  | "completed"                   // Agent finished successfully
  | "failed"                      // Agent exited with error
  | "interrupted"                 // Session killed or crashed
  | "stale";                      // Detected as orphaned (process gone, not properly ended)

interface SessionSnapshot {
  timestamp: string;              // ISO 8601
  label: string;                  // What triggered this snapshot (e.g., "task_2_completed", "approval_requested")
  task_progress: string | null;   // Current task status (e.g., "3 of 7 tasks done")
  decisions: string[];            // Key decisions made since last snapshot
  files_changed: string[];        // Files modified since last snapshot
  notes: string | null;           // Freeform context
}
```

### Write API

```typescript
// Register a new session
function createSession(opts: {
  project: string;
  agent_type: string;
  agent_pid?: number;
  task_description: string;
  parent_id?: string;             // If spawned by another session
  correlation_id?: string;        // If part of a larger intent (defaults to own id)
  metadata?: Record<string, unknown>;
}): SessionRecord;

// Update a running session's status and optionally capture a snapshot
function updateSession(sessionId: string, update: {
  status?: SessionStatus;
  snapshot?: Omit<SessionSnapshot, 'timestamp'>;
  metadata?: Record<string, unknown>; // Merged with existing metadata
}): SessionRecord;

// End a session
function endSession(sessionId: string, result: {
  status: "completed" | "failed" | "interrupted";
  exit_code?: number;
  snapshot?: Omit<SessionSnapshot, 'timestamp'>; // Final snapshot
  metadata?: Record<string, unknown>;
}): SessionRecord;
```

### Read API

```typescript
// Get a single session by ID
function getSession(sessionId: string): SessionRecord | null;

// List sessions with filters
function listSessions(filters?: {
  project?: string;
  status?: SessionStatus | SessionStatus[];
  agent_type?: string;
  correlation_id?: string;
  parent_id?: string;
  from?: string;                  // ISO 8601 — created_at >= from
  to?: string;                    // ISO 8601 — created_at <= to
  limit?: number;                 // Default 50
  offset?: number;
}): SessionRecord[];

// Get the full lineage tree for a session (ancestors + descendants)
function getLineage(sessionId: string): SessionLineage;

interface SessionLineage {
  root: SessionRecord;            // Topmost ancestor
  path_to_target: SessionRecord[]; // Root → target session (inclusive)
  children: SessionRecord[];      // Direct children of target
  descendants: SessionRecord[];   // All descendants (full subtree)
}

// Find sessions that appear stale (status "running" but process is gone)
function detectStale(): SessionRecord[];
```

### Events Emitted

All operations emit events into the Audit Trail:

| Event Type | When | Payload |
|------------|------|---------|
| `session.started` | New session created | `{ session_id, parent_id, agent_type, task_description }` |
| `session.updated` | Session status or snapshot changed | `{ session_id, status, snapshot_label }` |
| `session.ended` | Session completed/failed/interrupted | `{ session_id, status, exit_code, duration_ms }` |
| `session.stale_detected` | Running session with dead process found | `{ session_id, agent_type, agent_pid, last_updated }` |

### File Layout

```
~/.nexus/sessions/
└── sessions.jsonl               # All session records (all projects)
```

## Dependencies

| Dependency | What This System Uses |
|-----------|----------------------|
| Audit Trail | `emit()` to log all session lifecycle events |

## Architecture

### Data Flow

```
Agent Start (via Nexus CLI or adapter)
    │
    └── createSession() ──→ assign ID ──→ append to sessions.jsonl ──→ emit(session.started)

During Execution
    │
    └── updateSession() ──→ append updated record ──→ emit(session.updated)

Agent End
    │
    └── endSession() ──→ calculate duration ──→ append final record ──→ emit(session.ended)

Nexus Startup / Periodic
    │
    └── detectStale() ──→ check PIDs ──→ mark stale ──→ emit(session.stale_detected)
```

### Storage Model

Sessions use an **append-only log with latest-wins semantics:**
- Every `createSession`, `updateSession`, and `endSession` appends a new complete record to `sessions.jsonl`
- To get current state: read all records, group by `id`, take the latest record per session
- This is consistent with the Audit Trail pattern (PD-004) and avoids in-place file mutation
- Tradeoff: file grows with updates, not just new sessions. Acceptable for local single-developer use.

### Session Identity

- **ID:** UUID v4, assigned at creation, immutable
- **Parent pointer:** Optional `parent_id` creates a tree. Root sessions have `parent_id: null`
- **Correlation ID:** Groups sessions under a single user intent. Root sessions default to their own ID. Child sessions inherit the parent's correlation ID unless explicitly overridden
- Example tree:
  ```
  correlation_id: abc-123
  ├── Session A (root): "Implement auth feature" — parent_id: null
  │   ├── Session B: "Write auth tests" — parent_id: A
  │   └── Session C: "Update auth docs" — parent_id: A
  │       └── Session D: "Fix doc formatting" — parent_id: C
  ```

### Lineage Traversal

- **Ancestors:** Follow `parent_id` pointers up to root
- **Descendants:** Find all sessions where `parent_id` is in the subtree
- **Correlation group:** Find all sessions with the same `correlation_id`
- Implementation: in-memory after loading from JSONL. Acceptable at local scale.

### Stale Session Detection

1. Load all sessions with `status: "running"`
2. For each, check if `agent_pid` is still alive (OS process check)
3. If process is gone, mark session as `stale` via `updateSession`
4. Emit `session.stale_detected` event
5. Runs on Nexus startup and periodically (configurable interval, default 60 seconds)

**PID reuse risk:** A PID could be reused by a different process. Mitigation: also check process start time if available, and compare against `created_at`. On Windows, use `wmic` or `tasklist` to verify process name matches expected agent.

### Snapshots

Snapshots are embedded in the session record (not separate files) to keep the data model simple. They capture moments in time:
- **When:** At task boundaries, before/after approval requests, on significant decisions, before context window restart
- **Who triggers:** The agent adapter calls `updateSession` with a snapshot at appropriate moments
- **Size concern:** Snapshots are lightweight (strings and short arrays). If a session has 50+ snapshots, consider summarizing older ones.

## Implementation Patterns

### File I/O

- Use `packages/shared` JSONL utilities for all reads/writes
- Append path: same as Audit Trail (`fs.appendFile` with newline delimiter)
- Read path: load full file, group by `id`, take latest record per session
- For `listSessions` with filters: load, deduplicate, then filter in-memory

### Process Liveness Check

```typescript
// Cross-platform PID check
function isProcessAlive(pid: number): boolean;
// Windows: tasklist /FI "PID eq <pid>"
// Unix: kill -0 <pid> (signal 0 checks existence without killing)
```

### Concurrency

- Single Nexus instance (enforced by lock file)
- `createSession` / `updateSession` / `endSession` are single-writer safe (Node.js event loop)
- Read operations are safe to run concurrently

## Inherited Binding Decisions

| Decision ID | Summary | How This System Complies |
|-------------|---------|--------------------------|
| PD-001 | TypeScript as the sole language | Session Registry implemented entirely in TypeScript |
| PD-002 | File-based storage (JSONL/JSON) | Session records stored as JSONL in `~/.nexus/sessions/` |
| PD-003 | Local-only deployment for v1 | All operations local; `user_id` field on sessions for future multi-human |
| PD-004 | Append-only event log pattern | Session records are append-only (latest-wins); lifecycle events emitted to Audit Trail |
| PD-005 | Git worktree for change isolation | N/A — Session Registry does not perform git operations |
| PD-006 | Core and Dashboard are separate apps | Session Registry is a Core system; Dashboard reads its JSONL records |
| PD-007 | Centralized storage in `~/.nexus/` | Session data in `~/.nexus/sessions/`; `project` field on every record |
| CD-001 | Centralized `~/.nexus/` directory | Session records in `~/.nexus/sessions/sessions.jsonl` |
| CD-002 | Daily rotation for event logs | N/A — session records are a single file (events go to Audit Trail which handles rotation) |
| CD-003 | Agent-agnostic adapter interface | `agent_type` is a string, not an enum; any agent can register a session |
| CD-004 | CLI-first interface | `nexus session list/show/lineage/clean` commands expose all functionality |

## Decisions

| ID | Decision | Rationale | Scope | Status | Binding |
|----|----------|-----------|-------|--------|---------|
| SR-001 | Append-only with latest-wins for session state | Consistent with PD-004; avoids in-place mutation; full history preserved; acceptable growth at local scale | System | Accepted | Yes |
| SR-002 | Correlation ID defaults to own session ID for root sessions | Simplifies creation — caller doesn't need to generate a separate correlation ID; child sessions inherit automatically | System | Accepted | Yes |
| SR-003 | Snapshots embedded in session record, not separate storage | Keeps data model simple; one file, one record type; snapshots are lightweight enough to inline | System | Accepted | Yes |
| SR-004 | Stale detection uses PID check with process name verification | PID alone is unreliable due to reuse; checking process name reduces false positives | System | Accepted | Yes |

## AI Review Questions

| # | Section | Question | Answer |
|---|---------|----------|--------|
| 1 | Storage | With append-only latest-wins, the sessions file grows with every update, not just new sessions. When does this become a problem? | At ~100 sessions/day with ~5 updates each, that's ~500 records/day, ~45K in 90 days. At ~1KB each, ~45MB. Comfortable. If it grows beyond that, compact by rewriting with only latest records periodically. |
| 2 | Lineage | How deep can session trees get? Is there a risk of unbounded recursion in lineage traversal? | Practical depth is 3-5 levels (human starts session → agent spawns sub-agent → sub-agent spawns helper). Set a max depth of 20 with a warning. Iterative traversal, not recursive. |
| 3 | Stale Detection | What if Nexus itself crashes — who detects stale sessions then? | Next Nexus startup runs `detectStale()` as part of initialization. Sessions marked "running" from a previous Nexus instance are caught. |
| 4 | Snapshots | Who decides when to take a snapshot? If it's the agent adapter, different agents will have different snapshot granularity. | Accepted variation. Minimum contract: snapshot at session start and end. Optional: at task boundaries, approval requests, context restarts. The adapter's richness determines snapshot quality. |
| 5 | Cross-Project | Can a session span multiple projects (e.g., agent changes a shared lib and a consuming app)? | v1: one session = one project. If an agent touches multiple repos, that's multiple sessions linked by `correlation_id`. Future: consider a `projects: string[]` field. |
| 6 | Privacy | Session records include task descriptions and file paths. Is there sensitive data concern? | For local single-user, minimal risk. `~/.nexus/` permissions should be user-only (700). Future multi-human: access control on session reads would be needed. |

## Status

`Approved`
