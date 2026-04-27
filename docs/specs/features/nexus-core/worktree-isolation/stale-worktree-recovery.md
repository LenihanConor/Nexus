# Feature Spec: Stale Worktree Recovery

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Core | @docs/specs/applications/nexus-core.md |
| System | Worktree Isolation | @docs/specs/systems/nexus-core/worktree-isolation.md |

## Problem Statement

When an agent session crashes or is killed, its worktree is left orphaned on disk — it needs to be detected and offered for cleanup without forcing data loss.

## Acceptance Criteria

- [ ] `detectStaleWorktrees()` finds worktrees with status `active` whose owning session has ended or is stale
- [ ] Detected stale worktrees are marked as `stale` status in the JSONL record
- [ ] Emits `worktree.stale_detected` event for each stale worktree found
- [ ] Runs on Nexus startup and periodically (configurable, default 60 seconds)
- [ ] Cleanup is offered, not forced (per WI-003) — user must explicitly request cleanup
- [ ] `nexus worktree clean --stale` offers cleanup with confirmation for each stale worktree
- [ ] Stale worktrees with uncommitted changes show a warning before cleanup

## Data Models / API

```typescript
// Find stale worktrees
function detectStaleWorktrees(): Promise<WorktreeRecord[]>;

// Start periodic stale detection
function startStaleDetection(intervalMs?: number): void;  // Default 60000
function stopStaleDetection(): void;

// Check if a worktree has uncommitted changes
function isWorktreeDirty(worktreePath: string): Promise<boolean>;
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement `detectStaleWorktrees()` — cross-reference active worktrees with Session Registry | Not Started |
| 2 | Implement `isWorktreeDirty()` — run `git status --porcelain` in the worktree directory | Not Started |
| 3 | Implement periodic detection timer with configurable interval | Not Started |
| 4 | Add stale detection to Nexus startup sequence | Not Started |
| 5 | Implement `nexus worktree clean --stale` CLI with confirmation prompts | Not Started |
| 6 | Add tests: stale detection, dirty worktree warning, cleanup flow | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | Implemented in TypeScript |
| PD-004 | Append-only event log | Emits `worktree.stale_detected` events |
| PD-005 | Git worktree for change isolation | Manages stale worktrees created by the isolation system |
| WI-003 | Stale cleanup offered, not forced | Detection marks as stale; cleanup requires explicit user action |
| WI-004 | Git operations serialized | Dirty check and cleanup go through the serialization lock |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Detection | How does stale detection know the session has ended? | Cross-references with Session Registry's `detectStale()` + checks session status. If session is ended/failed/interrupted/stale but worktree is still active → stale. | Cross-reference Session Registry. If session is in a terminal state but worktree is `active`, mark worktree as `stale`. |
| 2 | Cleanup UX | Should `nexus worktree clean --stale` prompt per worktree or batch? | Per worktree with info (branch, project, dirty status). `--all` flag to batch without per-item prompts. | Per worktree with detail. `--all` flag for batch. `--dry-run` to preview without action. |
| 3 | Dirty Recovery | How should a user recover uncommitted work from a stale worktree? | Document the path: "Your worktree is at <path>. You can `cd` there, commit or copy files, then run cleanup." | Show the path and suggest: cd to worktree, commit or copy what you need, then re-run cleanup. |

## Status

`Done`
