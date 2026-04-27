# System Spec: Budget & Token Metering

## Parent Application

@docs/specs/applications/nexus-core.md

## Purpose

Budget & Token Metering is the cost visibility and enforcement layer for Nexus Core. It owns all token usage recording, cost estimation, and budget cap enforcement across sessions and projects. Every session's token consumption is tracked in real time; budgets are configured per-project or globally with soft (warn) and hard (block) caps. When a session nears or exceeds a cap, structured events are emitted to the audit trail and the user is notified via CLI.

This is what makes Nexus cost-safe — without it, agents can silently consume unbounded tokens across projects with no feedback until an API bill arrives.

## Features

| Feature | Description | Spec | Status |
|---------|-------------|------|--------|
| Token Usage Recording | Capture and persist token counts per session from hook stdin and audit trail enrichment | TBD | Planned |
| Budget Configuration | Per-project and global budget config in `~/.nexus/budget.json`; CLI to set, view, and reset budgets | TBD | Planned |
| Budget Enforcement | Evaluate session spend against caps at each checkpoint; emit threshold events; block or warn as configured | TBD | Planned |
| Spend Query CLI | `nexus budget status` and `nexus budget history` commands to inspect spend by project, session, or date range | TBD | Planned |

## Public Interfaces

### Budget Config (`~/.nexus/budget.json`)

```json
{
  "global": {
    "soft_cap_usd": 5.00,
    "hard_cap_usd": 10.00,
    "period": "daily"
  },
  "projects": {
    "C:/GitHub/MyProject": {
      "soft_cap_usd": 2.00,
      "hard_cap_usd": 4.00,
      "period": "daily"
    }
  }
}
```

### Token Usage Store (`~/.nexus/usage/usage.jsonl`)

Append-only JSONL records, one per session checkpoint:

```typescript
interface UsageRecord {
  id: string;                  // record ID
  session_id: string;          // links to SessionRecord
  project: string;             // project path (normalised)
  agent_type: string;
  timestamp: string;           // ISO 8601
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  model: string;               // e.g. "claude-sonnet-4-6"
  estimated_cost_usd: number;  // derived from model pricing
}
```

### TypeScript API

```typescript
/** Record token usage for a session checkpoint */
function recordUsage(entry: UsageInput): Promise<void>;

/** Get cumulative spend for a project within a time window */
function getProjectSpend(project: string, period: BudgetPeriod): Promise<SpendSummary>;

/** Get cumulative spend for a session */
function getSessionSpend(sessionId: string): Promise<SpendSummary>;

/** Check if a project is within budget — returns status and remaining */
function checkBudget(project: string): Promise<BudgetStatus>;

interface SpendSummary {
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  session_count: number;
  period_start: string;
  period_end: string;
}

interface BudgetStatus {
  status: "ok" | "soft_cap_reached" | "hard_cap_reached";
  spent_usd: number;
  soft_cap_usd: number | null;
  hard_cap_usd: number | null;
  remaining_usd: number | null;
  period: BudgetPeriod;
}

type BudgetPeriod = "daily" | "weekly" | "monthly" | "all-time";
```

### CLI Commands

| Command | Description |
|---------|-------------|
| `nexus budget status [--project <path>]` | Show current spend and cap status for a project or globally |
| `nexus budget history [--project <path>] [--days <n>]` | Show spend history grouped by day |
| `nexus budget set --project <path> --soft <usd> --hard <usd>` | Set per-project budget caps |
| `nexus budget set --global --soft <usd> --hard <usd>` | Set global budget caps |
| `nexus budget reset [--project <path>]` | Reset spend counters for current period |

### Events Emitted

| Event Type | When |
|------------|------|
| `budget.threshold_reached` | Session spend crosses the soft cap for its project |
| `budget.cap_exceeded` | Session spend crosses the hard cap; further sessions blocked |
| `budget.usage_recorded` | Token usage recorded at each session checkpoint |

### Dependencies

| Dependency | What This System Uses |
|-----------|-----------------------|
| Session Registry | `getSession` — look up session for project/agent context |
| Audit Trail | `emitEvent` — emit budget threshold and usage events |
| Agent Adapter | Provides token counts via hook stdin (`ParsedHookData.tokenCount`) |
| `packages/shared` | Shared types, JSONL utilities |

## Architecture

### Data Flow

```
Agent hook fires (Stop / PostToolUse)
    │
    ├── Hook stdin contains token counts (input, output, cache)
    │
    ▼
adapter hook handler
    │
    ├── parseHookStdin()  →  tokenCount, model
    │
    ├── recordUsage()     →  usage.jsonl (append)
    │
    └── checkBudget()
            │
            ├── status: "ok"                →  no action
            ├── status: "soft_cap_reached"  →  emit budget.threshold_reached
            │                                   warn in CLI output
            └── status: "hard_cap_exceeded" →  emit budget.cap_exceeded
                                                write block flag to session
```

### Model Pricing Table

Cost estimation uses a static pricing table (versioned in code). Only models in active use need entries. Unknown models default to `0` cost with a warning. Pricing is per-1K tokens.

```typescript
const MODEL_PRICING: Record<string, { input: number; output: number; cache_read: number; cache_creation: number }> = {
  "claude-opus-4-7":      { input: 0.015, output: 0.075, cache_read: 0.0015, cache_creation: 0.01875 },
  "claude-sonnet-4-6":    { input: 0.003, output: 0.015, cache_read: 0.0003, cache_creation: 0.00375 },
  "claude-haiku-4-5-*":   { input: 0.0008, output: 0.004, cache_read: 0.00008, cache_creation: 0.001 },
};
```

### Hard Cap Enforcement

When `hard_cap_exceeded` is reached:
- The current session is flagged in the session record (`metadata.budget_blocked: true`)
- Subsequent `nexus run` invocations for that project will check budget at start and refuse to launch if hard cap is still exceeded
- User must run `nexus budget reset` or raise the cap to unblock

### Module Structure

```
packages/core/src/budget/
├── types.ts       # UsageRecord, BudgetConfig, BudgetStatus, SpendSummary, etc.
├── pricing.ts     # MODEL_PRICING table and estimateCost()
├── store.ts       # recordUsage(), getSessionSpend(), getProjectSpend()
├── config.ts      # loadBudgetConfig(), saveBudgetConfig()
├── checker.ts     # checkBudget() — evaluates spend against config caps
└── index.ts       # Barrel exports
```

CLI commands in `packages/core/src/cli/budget.ts`, registered in `cli/index.ts`.

## Inherited Binding Decisions

| Decision ID | Summary | How This System Complies |
|-------------|---------|--------------------------|
| PD-001 | TypeScript as the sole language | All budget code is TypeScript |
| PD-002 | File-based storage (JSONL/JSON) | Usage records in `~/.nexus/usage/usage.jsonl`; budget config in `~/.nexus/budget.json` |
| PD-003 | Local-only deployment for v1 | All cost estimation and enforcement runs locally; no external pricing API calls |
| PD-004 | Append-only event log pattern | Usage records are append-only JSONL; budget events emitted through Core's audit trail |
| PD-005 | Git worktree for change isolation | Not directly applicable — budget system has no worktree concerns |
| PD-006 | Core and Dashboard are separate applications | Budget system lives in Core; Dashboard can read usage.jsonl and budget events from audit trail |
| PD-007 | Centralized storage in `~/.nexus/` | All usage and config stored in `~/.nexus/usage/` and `~/.nexus/budget.json` |
| CD-001 | Centralized `~/.nexus/` directory | Usage and config stored in `~/.nexus/` — no per-project files |
| CD-002 | Daily rotation for event logs | Budget events flow through standard audit trail with daily rotation; usage.jsonl is not rotated (queried by period in code) |
| CD-003 | Agent-agnostic adapter interface | Budget system receives token data via the common `ParsedHookData` type; no agent-specific logic |
| CD-004 | CLI-first interface | All budget operations available via `nexus budget` subcommands |

## Decisions

| ID | Decision | Rationale | Scope | Status | Binding |
|----|----------|-----------|-------|--------|---------|
| BM-001 | Static pricing table in code, not fetched from API | Avoids network dependency and API key requirements; pricing changes infrequently; version-controlled alongside the code that uses it | System | Accepted | Yes |
| BM-002 | Per-period spend derived by querying usage.jsonl, not maintained as a running total | Append-only usage records are the source of truth; derived period totals are computed at query time. Avoids state mutation and ensures correctness after resets or corrections | System | Accepted | Yes |
| BM-003 | Hard cap blocks new sessions at `nexus run`, not mid-session | Mid-session interruption is disruptive and may leave worktrees dirty. Cap enforcement at session start is safer and still effective | System | Accepted | Yes |
| BM-004 | Budget config is project-keyed by normalised path (forward slashes) | Consistent with the path normalisation fix applied in the dashboard; prevents key mismatches on Windows | System | Accepted | Yes |
| BM-005 | Unknown model costs default to zero with a logged warning, not an error | Prevents system from blocking sessions when a new model is released before the pricing table is updated | System | Accepted | Yes |

## AI Review Questions

| # | Section | Question | Answer |
|---|---------|----------|--------|
| 1 | Pricing | The static pricing table will drift as Anthropic changes prices. How does the user know it's stale? | The pricing table is versioned in code. A `nexus budget pricing` command should show the current table with a `last_updated` date. A warning is emitted when a model is found in the table but its pricing hasn't been updated in >90 days. The user can override per-model via `~/.nexus/budget.json` pricing overrides as an escape hatch. |
| 2 | Accuracy | Token counts come from hook stdin, which only fires on `Stop` and `PostToolUse`. Are cumulative counts accurate across a full session? | Token counts in Claude Code hook stdin are cumulative totals at the time the hook fires, not incremental. So the last `Stop` event gives the full session total. Intermediate `PostToolUse` checkpoints give partial totals, which are useful for in-session monitoring but should not be double-counted. The store must upsert by (session_id, event_type) or store the final Stop record as the canonical total. |
| 3 | Enforcement | What if a user opens two concurrent sessions for the same project — both below the hard cap individually but over it combined? | `checkBudget` queries cumulative spend for the project across all sessions in the current period, not per-session. Both sessions are checked against the same project total. Race condition is minimal since hard cap check at `nexus run` start is a point-in-time check; a small overshoot is acceptable for v1. |
| 4 | Reset | `nexus budget reset` clears spend counters. Does it delete usage records or just ignore them in period calculations? | Reset does not delete records — append-only is sacred (PD-004). Instead, it writes a `budget.reset` event to the audit trail with a timestamp. Period queries exclude usage records older than the last reset event for that project. |
| 5 | Periods | "Daily" period resets at midnight UTC or local time? | Local time (using Node's `Date` with system timezone). Most users think in local time for cost monitoring. UTC is an option for future multi-user support but adds complexity without clear benefit for v1. |
| 6 | Scope | Should the budget system also track non-Claude agents (Cursor, Aider)? | v1 only tracks agents that provide token counts via hook stdin — currently only Claude Code. Other agents default to zero cost with a note in `nexus budget status`. The usage schema includes `model` and `agent_type` fields so non-Claude data can be added later without migration. |

## Status

`Approved`
