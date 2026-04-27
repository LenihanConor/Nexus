# Feature Spec: Adapter Lifecycle

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Core | @docs/specs/applications/nexus-core.md |
| System | Agent Adapter | @docs/specs/systems/nexus-core/agent-adapter.md |

## Problem Statement

There is no automated way to register sessions, create worktrees, emit audit events, and clean up when an agent finishes — everything must be done manually via separate CLI commands. The adapter lifecycle provides a single orchestrated flow that composes Core's existing APIs into a coherent `start → checkpoint → end` contract that any agent integration can use.

## Acceptance Criteria

- [x] `AgentAdapter` interface defines `start(opts)`, `checkpoint(session, snapshot)`, `end(session, result)`
- [x] `BaseAdapter` implements the common lifecycle: start creates session + worktree + emits events; end updates session + optionally merges worktree + emits events; checkpoint updates session with snapshot
- [x] `GenericAdapter` extends BaseAdapter with no agent-specific behaviour — works for any agent out of the box
- [x] Adapter registry maps agent type strings to adapter instances (`getAdapter("claude-code")`, `getAdapter("generic")`)
- [x] `start()` returns an `AdapterSession` with all IDs needed for subsequent calls
- [x] `--no-worktree` mode: start creates a session but skips worktree creation; end skips merge
- [x] `end()` with `mergeStrategy: "skip"` leaves the worktree for manual merge
- [x] `end()` auto-merges on `status: "completed"` by default (merge --no-ff)
- [x] `end()` skips merge on `status: "failed"` or `"interrupted"` by default
- [x] All adapter operations go through Core's existing session/worktree/audit APIs — no direct file writes
- [x] Unit tests for BaseAdapter lifecycle (start, checkpoint, end in all status variants)

## Data Models / API

### Types (in `packages/core/src/adapter/types.ts`)

```typescript
interface AgentAdapter {
  readonly agentType: string;
  start(opts: AdapterStartOpts): Promise<AdapterSession>;
  checkpoint(session: AdapterSession, snapshot: AdapterSnapshot): Promise<void>;
  end(session: AdapterSession, result: AdapterResult): Promise<void>;
}

interface AdapterStartOpts {
  project: string;
  branch?: string;              // Required unless noWorktree
  task: string;
  scope?: string[];
  parentSessionId?: string;
  correlationId?: string;
  noWorktree?: boolean;
  metadata?: Record<string, unknown>;
}

interface AdapterSession {
  sessionId: string;
  worktreeId: string | null;    // null when noWorktree
  worktreePath: string | null;  // null when noWorktree
  project: string;
  branch: string | null;
  agentType: string;
  agentPid?: number;
  startedAt: string;
}

interface AdapterSnapshot {
  label: string;
  taskProgress?: string;
  filesChanged?: string[];
  decisions?: string[];
  tokenCount?: number;
  contextWindowPercent?: number;
  notes?: string;
}

interface AdapterResult {
  status: "completed" | "failed" | "interrupted";
  exitCode?: number;
  mergeStrategy?: "merge" | "fast-forward" | "rebase" | "skip";
  snapshot?: AdapterSnapshot;
  metadata?: Record<string, unknown>;
}
```

### Registry (in `packages/core/src/adapter/registry.ts`)

```typescript
function registerAdapter(adapter: AgentAdapter): void;
function getAdapter(agentType: string): AgentAdapter;  // Falls back to GenericAdapter
function listAdapters(): string[];
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Create types.ts with all adapter interfaces | Not Started |
| 2 | Create BaseAdapter with start/checkpoint/end calling Core APIs | Not Started |
| 3 | Create GenericAdapter extending BaseAdapter | Not Started |
| 4 | Create adapter registry with registration and fallback | Not Started |
| 5 | Create index.ts barrel exports | Not Started |
| 6 | Unit tests for BaseAdapter and registry | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript only | All adapter code is TypeScript |
| PD-002 | File-based storage | No new storage — writes through existing Core APIs |
| PD-004 | Append-only event log | Events emitted via `emitEvent` — append-only by design |
| PD-005 | Git worktree isolation | Worktree created via `createWorktree` from Worktree Isolation system |
| PD-007 | Centralized `~/.nexus/` | All data goes through Core's storage layer |
| CD-003 | Agent-agnostic adapter interface | `AgentAdapter` interface is agent-agnostic; `GenericAdapter` proves it |
| CD-004 | CLI-first | Adapter is a programmatic API consumed by the CLI orchestration feature |
| AA-001 | No direct file access | BaseAdapter calls `createSession`, `createWorktree`, `emitEvent` — never writes files directly |
| AA-003 | GenericAdapter as fallback | GenericAdapter provides basic lifecycle for any agent |
| AA-005 | Crash recovery via stale detection | Adapter records `agent_pid` in session; existing stale detection handles the rest |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Lifecycle | What happens if `createWorktree` fails (e.g., branch already exists)? Should start roll back the session? | Yes — end the session as "failed" and clean up | Yes. `start()` catches worktree creation errors, calls `endSession(sessionId, { status: "failed" })` to roll back, and re-throws. The session record captures the failure for audit. |
| 2 | Checkpoint | How frequently can checkpoint be called? Is there a rate limit? | No rate limit, but each call appends to JSONL | No artificial rate limit. Each checkpoint appends a snapshot to the session record and emits an event. Callers (hook handlers) should debounce if needed — the adapter itself doesn't throttle. |
| 3 | Registry | What if two adapters register for the same agent type? | Last registration wins | Last registration wins with a console warning. This allows agent-specific adapters to override the generic one at startup. |
| 4 | Merge | Auto-merge on "completed" could fail with conflicts. What then? | Mark worktree as "conflict", return result, don't throw | Correct. `end()` calls `mergeWorktree` which already handles conflicts gracefully — it aborts the merge, records conflicting files, and sets worktree status to "conflict". The adapter surfaces this in the return value but doesn't throw. |

## Status

`Done`
