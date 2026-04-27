# Plan: Worktree Isolation

**Spec:** @docs/specs/systems/nexus-core/worktree-isolation.md
**Status:** Done
**Started:** 2026-04-27
**Last Updated:** 2026-04-27

## Implementation Patterns

### Worktree Types (packages/shared)
- `WorktreeRecord`, `WorktreeStatus`, `MergeResult`, `ConflictReport` interfaces
- Shared so Dashboard can read worktree JSONL files

### Git Operations (packages/core)
- `execGit()` wrapper around `child_process.execFile` with cwd, timeout (30s), error capture
- `detectMainBranch()` via symbolic-ref then existence check
- All git ops serialized through a mutex (promise chain)

### Worktree Store (packages/core)
- Append-only JSONL at `~/.nexus/worktrees/worktrees.jsonl`
- Latest-wins: read all records, take latest per worktree ID for current state
- `appendWorktreeRecord()`, `getWorktree()`, `listWorktrees()`

### Conflict Detection (packages/core)
- `pathsOverlap()` — bidirectional prefix matching, normalized forward slashes, case-insensitive on Windows
- `checkConflicts()` — load active worktrees for project, compare scopes
- Auto-run in `createWorktree()` with `skipConflictCheck` bypass option

### Stale Detection (packages/core)
- `detectStaleWorktrees()` cross-references active worktrees with session states
- Session state check via a pluggable function (Session Registry not built yet)
- `isWorktreeDirty()` via `git status --porcelain` in worktree dir
- Periodic timer with configurable interval

### CLI (packages/core)
- `nexus worktree list/create/merge/clean` via Commander
- Flat table by default, `--json` flag, coloured status

## Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Worktree types — WorktreeRecord, MergeResult, ConflictReport in packages/shared | Done | Feature: worktree-lifecycle.md |
| 2 | Git utility — execGit(), detectMainBranch(), serialization lock | Done | Feature: worktree-lifecycle.md |
| 3 | Worktree store — JSONL read/write, latest-wins state derivation | Done | Feature: worktree-lifecycle.md |
| 4 | Worktree lifecycle — createWorktree(), mergeWorktree(), cleanupWorktree() | Done | Feature: worktree-lifecycle.md |
| 5 | Conflict detection — pathsOverlap(), checkConflicts() | Done | Feature: conflict-detection.md |
| 6 | Stale recovery — detectStaleWorktrees(), isWorktreeDirty(), periodic timer | Done | Feature: stale-worktree-recovery.md |
| 7 | CLI commands — nexus worktree list/create/merge/clean | Done | Feature: worktree-cli-commands.md |

## Session Notes

### 2026-04-27
- Audit Trail system complete, starting Worktree Isolation
- Session Registry not yet built; stale detection uses pluggable session checker
