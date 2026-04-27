# Feature Spec: Worktree Lifecycle

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Core | @docs/specs/applications/nexus-core.md |
| System | Worktree Isolation | @docs/specs/systems/nexus-core/worktree-isolation.md |

## Problem Statement

Agent tasks need isolated git worktrees that are automatically created, tracked, merged back, and cleaned up — without manual git commands.

## Acceptance Criteria

- [ ] `createWorktree()` creates a git worktree in the designated location with a named branch
- [ ] Worktree placed adjacent to project (e.g., `C:/GitHub/.nexus-worktrees/<project>-<branch-slug>/`) per WI-001
- [ ] Branch naming enforces conventions from tech.md (`feature/`, `bugfix/`, `docs/`)
- [ ] Worktree record appended to `~/.nexus/worktrees/worktrees.jsonl`
- [ ] `mergeWorktree()` merges the worktree's branch back to its parent branch
- [ ] Merge uses merge commit by default (preserves history); configurable
- [ ] `cleanupWorktree()` removes the worktree directory via `git worktree remove` and deletes the branch if fully merged
- [ ] All operations emit events into the Audit Trail
- [ ] All git commands run via `child_process.execFile` with timeout (30s default) per system spec
- [ ] Git operations serialized (one at a time) per WI-004

## Data Models / API

```typescript
function createWorktree(opts: {
  session_id: string;
  project: string;
  branch: string;
  parent_branch?: string;         // Defaults to project's main branch
  scope?: string[];
}): Promise<WorktreeRecord>;

function mergeWorktree(worktreeId: string, opts?: {
  strategy?: "merge" | "fast-forward" | "rebase";
}): Promise<MergeResult>;

function cleanupWorktree(worktreeId: string, opts?: {
  force?: boolean;                // Remove even if not merged
}): Promise<void>;

function getWorktree(worktreeId: string): WorktreeRecord | null;
```

### Internal Details

```typescript
// Resolve worktree directory path
function getWorktreePath(project: string, branch: string): string;
// Returns: C:/GitHub/.nexus-worktrees/cluiche-feature-add-auth/

// Detect the project's main branch
function detectMainBranch(projectPath: string): Promise<string>;

// Execute a git command with timeout and error capture
function execGit(projectPath: string, args: string[], timeoutMs?: number): Promise<GitResult>;

interface GitResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement `execGit()` — `child_process.execFile` wrapper with timeout, cwd, and error capture | Not Started |
| 2 | Implement `detectMainBranch()` — detect main/master via git remote | Not Started |
| 3 | Implement `getWorktreePath()` — resolve placement directory and generate slug | Not Started |
| 4 | Implement `createWorktree()` — validate branch name, create worktree, record to JSONL, emit event | Not Started |
| 5 | Implement `mergeWorktree()` — checkout parent, merge branch, record result, emit event | Not Started |
| 6 | Implement `cleanupWorktree()` — `git worktree remove`, delete branch if merged, record, emit event | Not Started |
| 7 | Implement serialization lock — ensure git operations run one at a time | Not Started |
| 8 | Add tests: create/merge/cleanup lifecycle, branch naming validation, timeout handling, serialization | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Implemented in TypeScript |
| PD-002 | File-based storage (JSONL/JSON) | Worktree records in `~/.nexus/worktrees/worktrees.jsonl` |
| PD-004 | Append-only event log | Emits events to Audit Trail for all operations |
| PD-005 | Git worktree for change isolation | This feature *implements* git worktree management |
| PD-007 | Centralized storage in `~/.nexus/` | Metadata in `~/.nexus/worktrees/`; worktree dirs adjacent to projects |
| WI-001 | Worktrees placed adjacent to project | Placement in `.nexus-worktrees/` next to project directory |
| WI-004 | Git operations serialized | Lock ensures one git operation at a time |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Placement | What if the adjacent directory doesn't exist or isn't writable? | Create it. If not writable, fall back to `~/.nexus/worktrees/<project-slug>/` per system spec AI Q1. | Create adjacent dir. Fall back to `~/.nexus/worktrees/` if not writable. Log which path was used. |
| 2 | Branch Detection | How to detect the main branch reliably? | `git symbolic-ref refs/remotes/origin/HEAD` then fall back to checking for `main` or `master` branch existence | Symbolic ref first, then existence check for main/master. Config override per project. |
| 3 | Merge Conflicts | What happens when `mergeWorktree()` hits conflicts? | Set status to `conflict`, record conflicting files in `MergeResult`, emit `worktree.merge_failed`, return — don't auto-resolve | Status → `conflict`, emit merge_failed event, return MergeResult with conflict file list. Human resolves. |
| 4 | Cleanup Force | Should `cleanupWorktree(id, { force: true })` delete even with uncommitted changes? | Yes — force is explicit user intent. Without force, refuse if worktree has uncommitted changes. | Yes, force means force. Without force: refuse if dirty, suggest `--force` in error message. |

## Status

`Approved`
