# Feature Spec: Audit Trail CLI Commands

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Core | @docs/specs/applications/nexus-core.md |
| System | Audit Trail | @docs/specs/systems/nexus-core/audit-trail.md |

## Problem Statement

Developers need terminal commands to inspect the audit trail without opening the Dashboard — list recent events, search by filters, and tail the live stream.

## Acceptance Criteria

- [ ] `nexus events list` — show recent events (default: last 20, today)
- [ ] `nexus events search --type <type> --session <id> --project <path> --from <date> --to <date>` — filtered search
- [ ] `nexus events tail` — live stream of new events (like `tail -f`)
- [ ] `nexus events tail --type <type>` — filtered tail
- [ ] Output formatted as a readable table with timestamp, type, project, and summary
- [ ] `--json` flag outputs raw JSON for piping to `jq` or other tools
- [ ] Graceful empty state: "No events found" with helpful suggestions

## Data Models / API

Uses `query()` and `tail()` from Event Query feature. CLI is a thin layer that parses arguments and formats output.

### Commands

```
nexus events list [options]
  --limit <n>          Number of events (default 20)
  --project <path>     Filter by project
  --type <type>        Filter by event type (prefix match)
  --session <id>       Filter by session ID
  --from <date>        Start date (ISO 8601 or "today", "yesterday")
  --to <date>          End date
  --json               Raw JSON output

nexus events search [options]
  (same options as list, but default limit is 100)

nexus events tail [options]
  --project <path>     Filter by project
  --type <type>        Filter by event type
  --session <id>       Filter by session ID
  --json               Raw JSON output
```

### Table Output Format

```
TIME      TYPE                    PROJECT    SUMMARY
14:42:03  worktree.created        Cluiche    feature/add-auth
14:42:01  session.started         Cluiche    Add auth flow
14:38:15  session.updated         Nexus      task_2_completed
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Set up CLI framework and `nexus` entry point (if not already done) | Not Started |
| 2 | Implement `nexus events list` — parse args, call `query()`, format table output | Not Started |
| 3 | Implement `nexus events search` — same as list with different defaults | Not Started |
| 4 | Implement `nexus events tail` — call `tail()`, stream formatted output | Not Started |
| 5 | Add `--json` flag support for raw JSON output | Not Started |
| 6 | Add human-friendly date parsing ("today", "yesterday", "7d") for `--from`/`--to` | Not Started |
| 7 | Add tests: argument parsing, output formatting, empty state | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | CLI implemented in TypeScript |
| PD-003 | Local-only deployment | CLI runs locally |
| CD-004 | CLI-first interface | This feature *is* the CLI interface for the Audit Trail |
| AT-002 | Malformed lines skipped | Delegates to `query()` / `tail()` which handle malformed lines |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | CLI Framework | Which CLI framework? Commander, oclif, yargs, or something else? | Commander — lightweight, well-known, minimal boilerplate | Commander. Lightest option that handles subcommands and options cleanly. |
| 2 | Summary Generation | Event summaries in the table reuse the same logic Dashboard needs. Should it live in `packages/shared`? | Yes — `summarizeEvent(event)` in shared, used by both CLI and Dashboard | Yes, shared. `summarizeEvent()` in `packages/shared` prevents drift between CLI and Dashboard descriptions. |
| 3 | Colour Output | Should the table use colour (green for running, red for failed, etc.)? | Yes, with `--no-color` flag and auto-detection of TTY | Yes, coloured output with `--no-color` flag and TTY detection for piping. |

## Status

`Approved`
