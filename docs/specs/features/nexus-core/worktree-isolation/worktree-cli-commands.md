# Feature Spec: Worktree CLI Commands

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Core | @docs/specs/applications/nexus-core.md |
| System | Worktree Isolation | @docs/specs/systems/nexus-core/worktree-isolation.md |

## Problem Statement

Developers need terminal commands to manage worktrees — list active ones, create them manually, merge completed work, and clean up stale or finished worktrees.

## Acceptance Criteria

- [ ] `nexus worktree list` — show active worktrees grouped by project with status, branch, and owning session
- [ ] `nexus worktree list --project <path>` — filter to one project
- [ ] `nexus worktree list --status <status>` — filter by status
- [ ] `nexus worktree create --project <path> --branch <name> --session <id>` — manually create a worktree
- [ ] `nexus worktree merge <id>` — merge a completed worktree back to parent
- [ ] `nexus worktree clean <id>` — remove a worktree from disk
- [ ] `nexus worktree clean --stale` — clean all stale worktrees with confirmation
- [ ] `--json` flag for machine-readable output
- [ ] Coloured output with status indicators matching Dashboard conventions

## Data Models / API

Uses `createWorktree()`, `mergeWorktree()`, `cleanupWorktree()`, `listWorktrees()`, and `detectStaleWorktrees()` from other Worktree Isolation features. CLI is a thin layer.

### Commands

```
nexus worktree list [options]
  --project <path>     Filter by project
  --status <status>    Filter by status (active, completed, merged, conflict, stale)
  --json               Raw JSON output

nexus worktree create [options]
  --project <path>     Project path (required)
  --branch <name>      Branch name (required, must follow conventions)
  --session <id>       Owning session ID (required)
  --parent <branch>    Parent branch (default: main)
  --scope <paths...>   Declared file scope

nexus worktree merge <worktree-id>
  --strategy <type>    Merge strategy: merge (default), fast-forward, rebase

nexus worktree clean <worktree-id>
  --force              Remove even if dirty or not merged

nexus worktree clean --stale
  --all                Skip per-worktree confirmation
  --dry-run            Preview what would be cleaned
```

### Table Output Format

```
PROJECT    BRANCH              STATUS   AGENT        SESSION
Cluiche    feature/add-auth    active   claude-code  ses-abc-1234
Cluiche    bugfix/login-fix    active   aider        ses-def-5678
Nexus      feature/add-events  merged   claude-code  ses-ghi-9012
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement `nexus worktree list` with project/status filters and table formatting | Not Started |
| 2 | Implement `nexus worktree create` with branch validation and scope declaration | Not Started |
| 3 | Implement `nexus worktree merge` with strategy option | Not Started |
| 4 | Implement `nexus worktree clean` for individual and `--stale` batch cleanup | Not Started |
| 5 | Add `--json` flag support across all commands | Not Started |
| 6 | Add coloured status output with TTY detection | Not Started |
| 7 | Add tests: argument parsing, output formatting, confirmation prompts | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | CLI implemented in TypeScript |
| PD-003 | Local-only deployment | CLI runs locally |
| PD-005 | Git worktree for change isolation | CLI is the user interface for worktree management |
| CD-004 | CLI-first interface | This feature *is* the CLI interface for Worktree Isolation |
| WI-003 | Stale cleanup offered, not forced | `clean --stale` requires confirmation; `--all` is opt-in |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Create | Should `nexus worktree create` be available to humans, or only used programmatically by adapters? | Both — humans may want to set up a worktree before starting an agent manually | Available to both. Manual worktree creation is a valid workflow for experienced users. |
| 2 | Merge | What if merge fails with conflicts — what does the CLI show? | List conflicting files, show worktree path so user can resolve manually, set status to `conflict` | Show conflict file list, worktree path, and instructions: "Resolve conflicts in <path>, then run `nexus worktree merge <id>` again." |
| 3 | Grouping | Should `list` group by project by default (like Dashboard) or show a flat table? | Flat table by default; `--group` flag for grouped view | Flat table default. Simple and pipe-friendly. `--group` for grouped display. |

## Status

`Approved`
