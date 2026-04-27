# System Spec: Context Health Monitor

## Parent Application

@docs/specs/applications/nexus-core.md

## Purpose

The Context Health Monitor watches active agent sessions for signs of context window degradation. It reads session metadata and hook-reported context window usage, compares it against configurable thresholds, and alerts the user via CLI output and a dashboard event when a session is approaching its context limit.

v1 is alert-only — the user decides what to do (continue, compact, restart). Checkpoint-and-restart automation is deferred to a future version.

## Features

| Feature | Description | Spec | Status |
|---------|-------------|------|--------|
| Context Usage Tracking | Capture context window % from hook stdin at each checkpoint and persist to session snapshots | TBD | Planned |
| Threshold Alerting | Compare context usage against configured thresholds; emit CLI warning and audit event when crossed | TBD | Planned |

## Public Interfaces

### Config (`~/.nexus/config.json`)

```json
{
  "context": {
    "warn_at_percent": 80,
    "critical_at_percent": 95
  }
}
```

Both thresholds are optional. Defaults: `warn_at_percent: 80`, `critical_at_percent: 95`.

### TypeScript API

```typescript
/** Evaluate context health for a session snapshot — returns alert level if threshold crossed */
function checkContextHealth(
  snapshot: AdapterSnapshot,
  config: ContextHealthConfig,
): ContextHealthResult;

interface ContextHealthConfig {
  warn_at_percent: number;
  critical_at_percent: number;
}

interface ContextHealthResult {
  level: "ok" | "warn" | "critical";
  context_window_percent: number;
  threshold_crossed: number | null; // the threshold value that was crossed
}
```

### Events Emitted

| Event Type | When |
|------------|------|
| `context.warn` | Session context window crosses `warn_at_percent` |
| `context.critical` | Session context window crosses `critical_at_percent` |

### CLI Output

When a threshold is crossed during a `nexus adapter hook` call, a warning is written to stderr:

```
[nexus] Warning: Session <id> context window at 82% (warn threshold: 80%)
[nexus] Critical: Session <id> context window at 96% — consider compacting or restarting
```

### Dashboard

`context.warn` and `context.critical` events appear in the Event Timeline panel with their standard event rendering. No new dashboard panel is needed — the audit trail surfacing is sufficient for v1.

## Dependencies

| Dependency | What This System Uses |
|-----------|-----------------------|
| Agent Adapter | `AdapterSnapshot.contextWindowPercent` — source of context usage data |
| Audit Trail | `emitEvent` — emit context health events |
| Session Registry | `getSession` — look up session for context enrichment |
| `packages/shared` | Shared types, config utilities |

## Architecture

### Data Flow

```
Agent hook fires (PreToolUse / PostToolUse / Stop)
    │
    └── parseHookStdin()  →  contextWindowPercent
            │
            └── checkContextHealth()
                    │
                    ├── level: "ok"       →  no action
                    ├── level: "warn"     →  emitEvent(context.warn)
                    │                        write warning to stderr
                    └── level: "critical" →  emitEvent(context.critical)
                                             write critical warning to stderr
```

### Threshold Crossing — Fire Once Per Level Per Session

To avoid repeated alerts on every hook call once a threshold is crossed, the monitor tracks which levels have already been emitted per session. A `warn` alert fires once when usage first crosses `warn_at_percent`; a `critical` alert fires once when usage first crosses `critical_at_percent`. Crossing state is held in memory for the duration of the adapter process (not persisted — sessions don't live long enough to need it).

### Module Structure

```
packages/core/src/context/
├── types.ts     # ContextHealthConfig, ContextHealthResult
├── checker.ts   # checkContextHealth()
├── config.ts    # loadContextConfig() from ~/.nexus/config.json
└── index.ts     # Barrel exports
```

Context health checks are invoked from the existing adapter hook handler (`packages/core/src/cli/adapter.ts`), not as a separate process. No new CLI commands needed for v1 — alerting is passive.

## Inherited Binding Decisions

| Decision ID | Summary | How This System Complies |
|-------------|---------|--------------------------|
| PD-001 | TypeScript as the sole language | All context monitor code is TypeScript |
| PD-002 | File-based storage (JSONL/JSON) | No new storage — context usage persisted via existing session snapshots; config in `~/.nexus/config.json` |
| PD-003 | Local-only deployment for v1 | Runs entirely locally; no external services |
| PD-004 | Append-only event log pattern | Context events emitted through Core's existing audit trail; no direct file writes |
| PD-005 | Git worktree for change isolation | Not applicable — this system has no worktree concerns |
| PD-006 | Core and Dashboard are separate applications | Context events appear in Dashboard via the standard audit trail; no direct coupling |
| PD-007 | Centralized storage in `~/.nexus/` | Config read from `~/.nexus/config.json`; no new storage locations |
| CD-001 | Centralized `~/.nexus/` directory | Config in `~/.nexus/config.json` alongside other Nexus config |
| CD-002 | Daily rotation for event logs | Context events flow through standard audit trail with daily rotation |
| CD-003 | Agent-agnostic adapter interface | Context data comes from `AdapterSnapshot.contextWindowPercent` — a field in the common adapter contract |
| CD-004 | CLI-first interface | Alerts surface in CLI stderr output; no GUI required |

## Decisions

| ID | Decision | Rationale | Scope | Status | Binding |
|----|----------|-----------|-------|--------|---------|
| CH-001 | Alert-only in v1; no checkpoint-and-restart | Checkpoint-and-restart requires task state capture and session seeding — significant complexity. Alert-only delivers the core value (user awareness) with minimal implementation risk | System | Accepted | Yes |
| CH-002 | Fire each alert level once per session (in-memory dedup) | Avoid alert fatigue from repeated warnings on every hook call. In-memory is sufficient — sessions don't outlive the adapter process | System | Accepted | Yes |
| CH-003 | Config lives in `~/.nexus/config.json` under a `context` key | Consistent with how other Nexus config is stored; avoids proliferating separate config files | System | Accepted | Yes |
| CH-004 | Context alerts surface in Dashboard via audit trail events, not a dedicated panel | Sufficient for v1; avoids Dashboard work before the feature is proven. A dedicated panel can be added later if the signal is useful | System | Accepted | No |

## AI Review Questions

| # | Section | Question | Answer |
|---|---------|----------|--------|
| 1 | Data Source | `contextWindowPercent` comes from Claude Code hook stdin — what if it's not present for some hook types? | The field is optional in `AdapterSnapshot`. If absent, `checkContextHealth` returns `level: "ok"` and no alert fires. The monitor degrades gracefully — it only alerts when data is available. |
| 2 | Thresholds | What if `warn_at_percent` >= `critical_at_percent` in config? | `loadContextConfig` validates that `warn < critical`. If invalid, it logs a warning and falls back to defaults (80/95). Does not throw — a misconfigured threshold should not block agent sessions. |
| 3 | Dedup | In-memory dedup means if the adapter process restarts mid-session (crash recovery), the alert could fire again. Is that acceptable? | Yes — a crash recovery scenario is an edge case, and re-alerting on restart is better than silently missing a critical context state. The duplicate event in the audit trail is acceptable. |
| 4 | Dashboard | `context.warn` and `context.critical` events will appear in the Event Timeline. Will they be visually distinct from other events? | The existing `EventTypeIcon` component uses event type prefixes for icons/colours. Adding `context.*` as a distinct category (e.g. yellow for warn, red for critical) is a small dashboard change that can be done alongside implementation. |
| 5 | Scope | Should context health also track conversation length (number of turns) as a degradation signal, not just token % ? | Deferred. Token % is a concrete, measurable signal available from hook stdin. Turn count is a weaker proxy. Add it in a future iteration if token % alone proves insufficient. |

## Status

`Approved`
