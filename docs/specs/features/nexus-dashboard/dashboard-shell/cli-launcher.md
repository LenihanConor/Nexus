# Feature Spec: CLI Launcher

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Dashboard | @docs/specs/applications/nexus-dashboard.md |
| System | Dashboard Shell | @docs/specs/systems/nexus-dashboard/dashboard-shell.md |

## Problem Statement

Developers need CLI commands to start and stop the Dashboard server without manual setup.

## Acceptance Criteria

- [ ] `nexus dashboard` — start the Dashboard server in foreground
- [ ] `nexus dashboard --background` — start as a background daemon
- [ ] `nexus dashboard stop` — stop a running Dashboard (foreground or background)
- [ ] `nexus dashboard status` — show whether Dashboard is running and on which port
- [ ] Foreground mode: logs to stdout, Ctrl+C to stop
- [ ] Background mode: detaches process, writes PID to `~/.nexus/dashboard.pid`
- [ ] `stop` reads PID file and sends termination signal
- [ ] Prevents duplicate instances — if already running, show URL instead of starting another

## Data Models / API

```
nexus dashboard [options]
  --port <n>           Override port (default from config or 3000)
  --no-open            Don't open browser on start
  --background         Run as background daemon

nexus dashboard stop

nexus dashboard status
```

### PID File

```
~/.nexus/dashboard.pid           # Contains PID of background Dashboard process
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Add `nexus dashboard` command to CLI framework | Done |
| 2 | Implement foreground start with graceful Ctrl+C shutdown | Done |
| 3 | Implement `--background` mode with detached child process and PID file | Done |
| 4 | Implement `nexus dashboard stop` — read PID, send SIGTERM, clean up PID file | Done |
| 5 | Implement `nexus dashboard status` — check PID file and process liveness | Done |
| 6 | Implement duplicate detection — check PID file before starting | Done |
| 7 | Add tests: start, stop, status, duplicate prevention, PID file management | Done |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript as sole language | CLI implemented in TypeScript |
| PD-003 | Local-only deployment | Starts local server only |
| CD-004 | CLI-first interface | Dashboard managed entirely via CLI commands |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Background | On Windows, `SIGTERM` doesn't work the same. How to stop a background process? | Use `process.kill(pid)` which works cross-platform in Node.js. On Windows, this sends `SIGTERM` equivalent via `TerminateProcess`. | `process.kill(pid)` — cross-platform in Node.js. Sufficient for a local tool. |
| 2 | Startup | Should `nexus dashboard` also start Core's stale detection, or is that independent? | Independent — Dashboard is read-only. Core's stale detection runs as part of Core, not Dashboard. | Independent. Dashboard is read-only. Core manages its own lifecycle. |

## Status

`Done`
