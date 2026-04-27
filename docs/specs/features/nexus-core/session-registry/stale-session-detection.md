# Feature Spec: Stale Session Detection

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Core | @docs/specs/applications/nexus-core.md |
| System | Session Registry | @docs/specs/systems/nexus-core/session-registry.md |

## Problem Statement

When an agent process dies without cleanly ending its session, the session is left in "running" state — it needs to be detected as stale so the user and other systems (Worktree Isolation) can respond.

## Acceptance Criteria

- [ ] `detectStale()` finds sessions with status `running` whose `agent_pid` process no longer exists
- [ ] PID check includes process name verification to handle PID reuse (per SR-004)
- [ ] Stale sessions marked as `stale` status via `updateSession()`
- [ ] Emits `session.stale_detected` event for each stale session
- [ ] Runs on Nexus startup and periodically (configurable, default 60 seconds)
- [ ] Cross-platform: works on Windows (`tasklist`) and Unix (`kill -0`)
- [ ] Sessions without `agent_pid` (null) are not checked — they're manually managed

## Data Models / API

```typescript
// Find and mark stale sessions
function detectStale(): Promise<SessionRecord[]>;

// Check if a specific PID is alive and matches expected process
function isProcessAlive(pid: number, expectedName?: string): Promise<boolean>;

// Start/stop periodic stale detection
function startStaleDetection(intervalMs?: number): void;   // Default 60000
function stopStaleDetection(): void;
```

### Platform-Specific Process Check

```typescript
// Windows: tasklist /FI "PID eq <pid>" /FO CSV
// Parse output to check if PID exists and process name matches

// Unix: kill(pid, 0) for existence check
// /proc/<pid>/comm or ps -p <pid> -o comm= for name check
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement `isProcessAlive()` — cross-platform PID + process name check | Not Started |
| 2 | Implement `detectStale()` — load running sessions, check PIDs, mark stale | Not Started |
| 3 | Implement periodic detection timer | Not Started |
| 4 | Add stale detection to Nexus startup sequence | Not Started |
| 5 | Add tests: alive process, dead process, PID reuse with wrong name, null PID skip, Windows/Unix paths | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Implemented in TypeScript |
| PD-003 | Local-only deployment | Process checks are local OS operations |
| PD-004 | Append-only event log | Emits `session.stale_detected` events |
| SR-001 | Append-only with latest-wins | Stale marking appends a new record via `updateSession()` |
| SR-004 | PID check with process name verification | `isProcessAlive()` verifies both PID existence and process name |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Process Name | What process name to expect for different agents? | Agent-type-specific: "claude" or "node" for Claude Code, "cursor" for Cursor, etc. Store expected process name in session metadata at creation time. | Store expected process name in session metadata. If not provided, skip name verification (PID-only check). |
| 2 | Timing | 60-second interval — is that too aggressive or too lazy? | Good default. Agent crashes are not time-critical — a 60-second delay is fine. Configurable for users who want faster detection. | 60 seconds is fine. Configurable via `~/.nexus/config.json`. |
| 3 | Shared Timer | Stale session detection and stale worktree detection both run periodically. Should they share a timer? | Yes — run both in the same periodic check. Stale sessions are detected first, then stale worktrees (which depend on session status). | Yes, single timer. Session detection first, worktree detection second (depends on updated session status). |

## Status

`Approved`
