# Feature Spec: Session CLI Commands

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Core | @docs/specs/applications/nexus-core.md |
| System | Session Registry | @docs/specs/systems/nexus-core/session-registry.md |

## Problem Statement

Developers need terminal commands to inspect sessions — list active and recent sessions, view session detail with snapshots, and trace lineage trees.

## Acceptance Criteria

- [ ] `nexus session list` — show recent sessions (default: last 20) with status, agent, project, and duration
- [ ] `nexus session list --status <status>` — filter by status
- [ ] `nexus session list --project <path>` — filter by project
- [ ] `nexus session list --agent <type>` — filter by agent type
- [ ] `nexus session show <id>` — full detail for one session including snapshots
- [ ] `nexus session lineage <id>` — print the session tree (ancestors + descendants) as an indented tree
- [ ] `nexus session clean --stale` — mark stale sessions as interrupted with confirmation
- [ ] `--json` flag for machine-readable output
- [ ] Coloured output with status indicators matching Dashboard conventions

## Data Models / API

Uses `listSessions()`, `getSession()`, `getLineage()`, and `detectStale()` from other Session Registry features. CLI is a thin layer.

### Commands

```
nexus session list [options]
  --limit <n>          Number of sessions (default 20)
  --status <status>    Filter: running, paused, completed, failed, interrupted, stale
  --project <path>     Filter by project
  --agent <type>       Filter by agent type
  --from <date>        Created after date
  --to <date>          Created before date
  --json               Raw JSON output

nexus session show <session-id>
  --json               Raw JSON output

nexus session lineage <session-id>
  --json               Raw JSON output

nexus session clean --stale
  --all                Skip per-session confirmation
  --dry-run            Preview what would be cleaned
```

### Table Output Format (list)

```
STATUS    AGENT        PROJECT    TASK                     DURATION
● run     claude-code  Cluiche    Add auth flow            12m
● run     aider        Nexus      Fix lint errors           3m
○ done    claude-code  Cluiche    Write tests              45m
◌ stale   cursor       Cluiche    Refactor API              2h
```

### Tree Output Format (lineage)

```
Session Lineage: ses-abc-1234
Correlation: cor-xyz-5678 — "Implement auth feature"

○ ses-111 "Implement auth feature" (45m, completed)
├── ● ses-222 "Write auth middleware" (12m, running)  ← current
│   └── ○ ses-444 "Fix middleware bug" (3m, completed)
└── ○ ses-333 "Write auth tests" (20m, completed)
```

### Detail Output Format (show)

```
Session: ses-abc-1234
Status:      ● running
Agent:       claude-code (PID 12345)
Project:     C:/GitHub/Cluiche
Task:        Add authentication flow
Started:     2026-04-27 14:30 (12m ago)
Correlation: cor-xyz-5678
Parent:      ses-def-9012

Snapshots:
  14:30  session_started
  14:33  task_1_completed — "Set up auth middleware"
         Files: src/auth/middleware.ts, src/config.ts
  14:38  task_2_completed — "Add login endpoint"
         Files: src/auth/login.ts, src/routes.ts
         Decision: Used JWT over session tokens

Metadata:
  tokens_used: 45000
  files_changed: 4
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement `nexus session list` with filters and table formatting | Not Started |
| 2 | Implement `nexus session show` with snapshot timeline and metadata | Not Started |
| 3 | Implement `nexus session lineage` with indented tree rendering | Not Started |
| 4 | Implement `nexus session clean --stale` with confirmation | Not Started |
| 5 | Add `--json` flag support across all commands | Not Started |
| 6 | Add coloured status output with TTY detection | Not Started |
| 7 | Add tests: argument parsing, tree rendering, output formatting | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | CLI implemented in TypeScript |
| PD-003 | Local-only deployment | CLI runs locally |
| CD-004 | CLI-first interface | This feature *is* the CLI interface for Session Registry |
| SR-001 | Append-only with latest-wins | CLI reads deduplicated session records |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Lineage | How to render the tree in the terminal — Unicode box-drawing or ASCII? | Unicode (`├──`, `└──`, `│`) with fallback to ASCII if terminal doesn't support it | Unicode default. `--ascii` flag for fallback. Modern terminals all support Unicode. |
| 2 | Clean | Should `session clean --stale` also trigger worktree stale cleanup? | No — keep commands scoped to their system. User runs `nexus worktree clean --stale` separately. Suggest it in the output. | No, scoped to sessions. Output: "Tip: also run `nexus worktree clean --stale` to clean orphaned worktrees." |
| 3 | Duration | How to format duration — "12m", "2h 15m", "3d"? | Human-friendly: "12m", "2h 15m", "1d 3h". No seconds unless under 1 minute. | Human-friendly. Under 1m: "45s". Over 1d: "1d 3h". Shared utility in `packages/shared`. |

## Status

`Done`
