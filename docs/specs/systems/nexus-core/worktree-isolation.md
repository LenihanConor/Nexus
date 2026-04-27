# System Spec: Worktree Isolation

## Parent Application

@docs/specs/applications/nexus-core.md

## Purpose

Worktree Isolation owns the automatic creation, management, and cleanup of git worktrees for concurrent agent tasks across all tracked projects. When an agent starts work on a project, Nexus gives it an isolated working directory so it cannot collide with other agents at the file level. The system detects scope conflicts before they happen, handles merge-back on completion, and cleans up on success or failure.

This is the cheapest, most familiar form of isolation — it uses git's built-in worktree mechanism, enforces the branch naming conventions from tech.md, and emits all operations as events into the Audit Trail.

## Features

| Feature | Description | Spec | Status |
|---------|-------------|------|--------|
| Worktree Lifecycle | Create, track, merge, and cleanup git worktrees tied to agent sessions | @docs/specs/features/nexus-core/worktree-isolation/worktree-lifecycle.md | Planned |
| Conflict Detection | Pre-flight check for file-scope overlap between a proposed task and active worktrees | @docs/specs/features/nexus-core/worktree-isolation/conflict-detection.md | Planned |
| Stale Worktree Recovery | Detect and offer cleanup of orphaned worktrees from crashed sessions | @docs/specs/features/nexus-core/worktree-isolation/stale-worktree-recovery.md | Planned |
| CLI Commands | `nexus worktree list`, `nexus worktree create`, `nexus worktree merge`, `nexus worktree clean` | @docs/specs/features/nexus-core/worktree-isolation/worktree-cli-commands.md | Planned |

## Public Interfaces

### Worktree Record Schema

```typescript
interface WorktreeRecord {
  id: string;                     // Unique worktree ID (UUID v4)
  session_id: string;             // Owning session
  project: string;                // Project path (e.g., "C:/GitHub/Cluiche")
  branch: string;                 // Branch name (e.g., "feature/add-auth")
  parent_branch: string;          // Branch this was created from (e.g., "main")
  path: string;                   // Absolute path to the worktree directory
  scope: string[];                // Declared file/directory scope (e.g., ["src/auth/", "src/config.ts"])
  status: WorktreeStatus;         // Current lifecycle state
  created_at: string;             // ISO 8601
  merged_at: string | null;       // ISO 8601, set on successful merge
  cleaned_at: string | null;      // ISO 8601, set on cleanup
  merge_result: MergeResult | null; // Result of merge attempt
}

type WorktreeStatus =
  | "active"                      // Agent is working in this worktree
  | "completed"                   // Agent finished, awaiting merge
  | "merged"                      // Successfully merged back to parent
  | "conflict"                    // Merge attempted, conflicts found
  | "stale"                       // Owning session died, worktree orphaned
  | "cleaned";                    // Worktree removed from disk

interface MergeResult {
  success: boolean;
  conflicts: string[];            // File paths with conflicts (empty if success)
  commits_merged: number;
}
```

### Write API

```typescript
// Create a new worktree for an agent session
function createWorktree(opts: {
  session_id: string;
  project: string;
  branch: string;
  parent_branch?: string;         // Defaults to project's main branch
  scope?: string[];               // Declared file scope for conflict detection
}): WorktreeRecord;

// Merge a completed worktree back to its parent branch
function mergeWorktree(worktreeId: string): MergeResult;

// Remove a worktree from disk and mark as cleaned
function cleanupWorktree(worktreeId: string): void;

// Mark a worktree as stale (owning session died)
function markStale(worktreeId: string): void;
```

### Read API

```typescript
// List worktrees, optionally filtered
function listWorktrees(filters?: {
  project?: string;
  session_id?: string;
  status?: WorktreeStatus | WorktreeStatus[];
}): WorktreeRecord[];

// Check if proposed scope conflicts with any active worktrees in the same project
function checkConflicts(project: string, scope: string[]): ConflictReport;

interface ConflictReport {
  has_conflicts: boolean;
  conflicts: Array<{
    worktree_id: string;
    session_id: string;
    branch: string;
    overlapping_paths: string[];  // Paths that overlap between proposed and active scope
  }>;
}
```

### Events Emitted

All operations emit events into the Audit Trail:

| Event Type | When | Payload |
|------------|------|---------|
| `worktree.created` | New worktree created | `{ worktree_id, branch, parent_branch, path, scope }` |
| `worktree.conflict_detected` | Pre-flight scope check finds overlap | `{ worktree_id, conflicting_session_id, overlapping_paths }` |
| `worktree.merged` | Worktree merged back to parent | `{ worktree_id, branch, merge_result }` |
| `worktree.merge_failed` | Merge attempted but conflicts found | `{ worktree_id, branch, conflicts }` |
| `worktree.stale_detected` | Orphaned worktree found | `{ worktree_id, session_id, branch }` |
| `worktree.cleaned` | Worktree removed from disk | `{ worktree_id, branch, path }` |

### File Layout

```
~/.nexus/worktrees/
└── worktrees.jsonl              # All worktree records (all projects)
```

Worktree directories themselves live adjacent to the project repo, managed by git:
```
C:/GitHub/Cluiche/                # Original project repo
C:/GitHub/.nexus-worktrees/       # Nexus-managed worktree directories
├── cluiche-feature-add-auth/     # Worktree for Cluiche feature branch
└── cluiche-bugfix-login/         # Another worktree for Cluiche
```

## Dependencies

| Dependency | What This System Uses |
|-----------|----------------------|
| Audit Trail | `emit()` to log all worktree lifecycle events |
| Git | `git worktree add/remove`, `git merge`, `git branch` on target project repos |
| Session Registry | Reads session status to detect stale worktrees (session ended but worktree still active) |

## Architecture

### Data Flow

```
Agent Task Request
    │
    ├── checkConflicts(project, scope)
    │       │
    │       ├── No conflicts ──→ createWorktree() ──→ git worktree add ──→ emit(worktree.created)
    │       │
    │       └── Conflicts found ──→ emit(worktree.conflict_detected) ──→ return to caller
    │
Agent Completes
    │
    ├── mergeWorktree() ──→ git merge ──→ emit(worktree.merged) or emit(worktree.merge_failed)
    │
    └── cleanupWorktree() ──→ git worktree remove ──→ emit(worktree.cleaned)
```

### Worktree Placement

Worktrees are created in a `.nexus-worktrees/` directory adjacent to the project, not inside the project:
- **Why adjacent:** Placing worktrees inside the project pollutes the directory; placing them in `~/.nexus/` puts large file trees far from the repo's object store
- **Naming:** `<project-name>-<branch-slug>/` for human readability
- **Cleanup:** On `cleanupWorktree()`, the directory is removed via `git worktree remove`

### Branch Naming

Enforces conventions from tech.md:
- `feature/<name>`, `bugfix/<description>`, `docs/<update>`
- Branch created from `parent_branch` (defaults to project's main branch)
- Branch deleted on cleanup if fully merged

### Conflict Detection

Scope-based overlap check:
1. Caller declares `scope` — list of file paths or directory prefixes the agent intends to touch
2. System checks all `active` worktrees for the same project
3. If any declared scope overlaps, returns `ConflictReport` with details
4. Caller decides: serialize (wait), override (proceed anyway), or abort

Scope is **advisory** — agents may touch files outside their declared scope. This is a best-effort prevention, not enforcement. Full enforcement would require filesystem-level locks, which is out of scope for v1.

### Stale Worktree Recovery

On Nexus startup and periodically during runtime:
1. List all worktrees with status `active`
2. For each, check if the owning session is still alive (via Session Registry)
3. If session is ended/interrupted but worktree is still active, mark as `stale`
4. Emit `worktree.stale_detected` event
5. CLI command `nexus worktree clean --stale` offers cleanup with confirmation

Recovery is **offered, not forced** — the stale worktree may contain uncommitted work the user wants to salvage.

## Implementation Patterns

### Git Operations

- All git commands executed via `child_process.execFile` (not shell) for safety
- Working directory set to the project repo for worktree commands
- Timeout on all git operations (30 seconds default)
- Error output captured and included in events

### File I/O

- Worktree records stored in `~/.nexus/worktrees/worktrees.jsonl` using shared JSONL utilities
- Records are append-only for history; current state derived by reading latest record per worktree ID
- Alternative: could use a JSON file with in-place updates, but append-only is consistent with Audit Trail pattern

### Concurrency

- Single Nexus instance (enforced by lock file)
- Conflict detection reads current state, which is safe in single-writer model
- Git worktree operations are serialized (one at a time) to prevent git lock contention

## Inherited Binding Decisions

| Decision ID | Summary | How This System Complies |
|-------------|---------|--------------------------|
| PD-001 | TypeScript as the sole language | Worktree Isolation implemented entirely in TypeScript |
| PD-002 | File-based storage (JSONL/JSON) | Worktree metadata stored as JSONL in `~/.nexus/worktrees/` |
| PD-003 | Local-only deployment for v1 | All git operations are local filesystem; no remote push/pull |
| PD-004 | Append-only event log pattern | All operations emit events into the Audit Trail |
| PD-005 | Git worktree for change isolation | This system *is* the git worktree manager |
| PD-006 | Core and Dashboard are separate apps | Worktree Isolation is a Core system; Dashboard reads its JSONL records |
| PD-007 | Centralized storage in `~/.nexus/` | Worktree metadata in `~/.nexus/worktrees/`; worktree directories adjacent to target projects |
| CD-001 | Centralized `~/.nexus/` directory | Metadata in `~/.nexus/worktrees/worktrees.jsonl` |
| CD-002 | Daily rotation for event logs | N/A — worktree metadata is a single file, not rotated (events go to Audit Trail which handles rotation) |
| CD-003 | Agent-agnostic adapter interface | Worktree creation takes a session_id — any agent type can request one |
| CD-004 | CLI-first interface | `nexus worktree list/create/merge/clean` commands expose all functionality |

## Decisions

| ID | Decision | Rationale | Scope | Status | Binding |
|----|----------|-----------|-------|--------|---------|
| WI-001 | Worktree directories placed adjacent to project, not inside it | Avoids polluting the project directory; keeps worktrees close to git object store for performance | System | Accepted | Yes |
| WI-002 | Scope-based conflict detection is advisory, not enforced | Filesystem-level enforcement is complex and fragile; advisory detection covers the common case (two agents declaring the same task area) without the cost | System | Accepted | Yes |
| WI-003 | Stale worktree cleanup is offered, not forced | Stale worktrees may contain uncommitted work the user wants to recover; destructive cleanup requires explicit confirmation | System | Accepted | Yes |
| WI-004 | Git operations serialized (one at a time) | Prevents git index lock contention; git worktree operations are fast enough that serialization is not a bottleneck | System | Accepted | Yes |

## AI Review Questions

| # | Section | Question | Answer |
|---|---------|----------|--------|
| 1 | Placement | What if the user doesn't have write access adjacent to the project (e.g., project in a read-only mount)? | Fallback to `~/.nexus/worktrees/<project-slug>/` for the worktree directory. Config option to override placement per project. |
| 2 | Conflicts | What if an agent touches files outside its declared scope? The conflict check won't catch it. | Accepted limitation for v1 (WI-002). Phase 2 could add post-hoc conflict detection at merge time by comparing actual changed files against all active scopes. |
| 3 | Git State | What if the project repo is in a dirty state (uncommitted changes) when a worktree is created? | Worktree creation uses `git worktree add` which creates from the committed state of the parent branch. Uncommitted changes in the main worktree are not carried over. Document this behavior clearly. |
| 4 | Scale | How many concurrent worktrees per project is reasonable? | Git handles dozens of worktrees fine. Practical limit is disk space and cognitive overhead. Default soft limit of 10 active worktrees per project with a warning; configurable. |
| 5 | Merge Strategy | What merge strategy — fast-forward only, merge commit, or rebase? | Default to merge commit (preserves history of what was done in the worktree). Config option per project. Fast-forward when possible if the user prefers linear history. |
| 6 | Windows Paths | Worktree paths on Windows can hit the 260-char limit. Is this a risk? | Yes. Mitigation: keep worktree directory names short (`<project>-<branch-slug>`) and place them as close to drive root as practical (e.g., `C:/.nexus-worktrees/`). Config option for placement path. |

## Status

`Approved`
