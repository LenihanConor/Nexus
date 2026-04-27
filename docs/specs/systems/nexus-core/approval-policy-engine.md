# System Spec: Approval Policy Engine

## Parent Application

@docs/specs/applications/nexus-core.md

## Purpose

The Approval Policy Engine classifies every agent tool call into a severity tier and enforces an appropriate approval action before the tool executes. Routine actions pass through silently; constrained actions pause briefly and auto-proceed if unattended; standard actions block until explicitly approved; critical actions block unconditionally with no timeout.

This is what gives developers control without becoming the bottleneck — the engine handles the routine, surfaces the important, and hard-stops the dangerous.

## Features

| Feature | Description | Spec | Status |
|---------|-------------|------|--------|
| Rule Engine | Classify tool calls into tiers (routine / constrained / standard / critical) based on configurable rules matching tool name and arguments | TBD | Planned |
| Approval Enforcement | Apply the appropriate enforcement action per tier: auto-approve, block-with-timeout, or block-until-approved | TBD | Planned |
| Approval CLI | `nexus approve` and `nexus reject` commands; `nexus approval queue` to inspect pending decisions | TBD | Planned |
| Audit Logging | Emit structured events for every approval decision — auto or human — to the audit trail | TBD | Planned |

## Public Interfaces

### Approval Config (`~/.nexus/approval.json`)

```json
{
  "global": {
    "default_tier": "standard",
    "timeout_seconds": 30
  },
  "rules": [
    { "tool": "Read",      "tier": "routine" },
    { "tool": "Glob",      "tier": "routine" },
    { "tool": "Grep",      "tier": "routine" },
    { "tool": "Bash",      "args_match": "git (status|diff|log|add|commit)", "tier": "constrained" },
    { "tool": "Bash",      "args_match": "git push(?!.*main)",               "tier": "standard" },
    { "tool": "Bash",      "args_match": "git push.*main",                   "tier": "critical" },
    { "tool": "Bash",      "args_match": "git reset --hard",                 "tier": "critical" },
    { "tool": "Bash",      "args_match": "rm ",                              "tier": "critical" },
    { "tool": "Write",     "tier": "constrained" },
    { "tool": "Edit",      "tier": "standard" },
    { "tool": "WebFetch",  "tier": "standard" },
    { "tool": "WebSearch", "tier": "routine" }
  ],
  "projects": {
    "C:/GitHub/MyProject": {
      "rules": [
        { "tool": "Edit", "tier": "critical" }
      ]
    }
  }
}
```

Rules are evaluated top-to-bottom; first match wins. If no rule matches, `default_tier` applies.

### Tier → Enforcement Action

| Tier | Action | Description |
|------|--------|-------------|
| `routine` | Auto-approve | No interruption; decision logged silently |
| `constrained` | Block with timeout | Pauses for `timeout_seconds`; auto-approves if no response; user can approve or reject early |
| `standard` | CLI blocking | Pauses indefinitely; waits for explicit `nexus approve` or `nexus reject` |
| `critical` | CLI blocking, no timeout | Pauses indefinitely; no auto-approve under any circumstances |

### TypeScript API

```typescript
/** Classify a tool call against the loaded rule set */
function classifyToolCall(
  tool: string,
  args: Record<string, unknown>,
  project: string,
  config: ApprovalConfig,
): ApprovalTier;

/** Request approval for a tool call — blocks until resolved or timeout */
function requestApproval(
  sessionId: string,
  tool: string,
  args: Record<string, unknown>,
  tier: ApprovalTier,
  config: ApprovalConfig,
): Promise<ApprovalDecision>;

type ApprovalTier = "routine" | "constrained" | "standard" | "critical";

interface ApprovalDecision {
  approved: boolean;
  method: "auto" | "timeout" | "human";
  decided_at: string;
  decided_by?: string; // user_id if human
}
```

### CLI Commands

| Command | Description |
|---------|-------------|
| `nexus approval queue` | List all pending approval requests |
| `nexus approve <id>` | Approve a pending request by ID |
| `nexus reject <id> [--reason <text>]` | Reject a pending request |
| `nexus approval history [--session <id>] [--days <n>]` | Show past approval decisions |
| `nexus approval rules` | Print the active rule set (global + project overrides) |

### Pending Requests Store (`~/.nexus/approvals/pending.json`)

```typescript
interface PendingApproval {
  id: string;
  session_id: string;
  project: string;
  tool: string;
  args: Record<string, unknown>;
  tier: ApprovalTier;
  requested_at: string;
  timeout_at: string | null; // null for critical tier
}
```

### Events Emitted

| Event Type | When |
|------------|------|
| `approval.requested` | A constrained / standard / critical tool call is intercepted |
| `approval.auto_approved` | Routine tier — logged silently |
| `approval.timeout_approved` | Constrained tier — timeout elapsed with no human response |
| `approval.human_approved` | Human ran `nexus approve` |
| `approval.rejected` | Human ran `nexus reject` |

## Dependencies

| Dependency | What This System Uses |
|-----------|-----------------------|
| Agent Adapter | `PreToolUse` hook — intercepts tool calls before execution; hook must return non-zero to block |
| Audit Trail | `emitEvent` — emit all approval decision events |
| Session Registry | `getSession` — look up session for project context |
| `packages/shared` | Shared types, config utilities, JSONL utilities |

## Architecture

### Data Flow

```
Claude Code fires PreToolUse hook
    │
    ├── classifyToolCall(tool, args, project, config)
    │       │
    │       ├── "routine"     →  auto-approve, emit approval.auto_approved (silent)
    │       │                    exit 0 (hook allows tool to proceed)
    │       │
    │       ├── "constrained" →  write to pending.json
    │       │                    print timeout warning to stderr
    │       │                    poll pending.json for approval/rejection
    │       │                    timeout elapses → emit approval.timeout_approved
    │       │                    exit 0
    │       │
    │       ├── "standard"    →  write to pending.json
    │       │                    print blocking message to stderr
    │       │                    poll pending.json until human decision
    │       │                    approved  → emit approval.human_approved, exit 0
    │       │                    rejected  → emit approval.rejected, exit 1
    │       │
    │       └── "critical"    →  write to pending.json
    │                            print critical block message to stderr
    │                            poll pending.json — no timeout
    │                            approved  → emit approval.human_approved, exit 0
    │                            rejected  → emit approval.rejected, exit 1
    │
    └── Claude Code reads hook exit code:
            exit 0  →  tool proceeds
            exit 1  →  tool is blocked (Claude Code handles as tool error)
```

### Hook Blocking Mechanism

Claude Code's `PreToolUse` hook can block tool execution by exiting with a non-zero exit code. The approval engine uses this:
- Approved or timed-out → `exit 0` → tool proceeds
- Rejected → `exit 1` → tool is blocked; Claude Code receives an error and can decide how to proceed

The hook process polls `pending.json` for its own request ID to detect a human decision made via `nexus approve` / `nexus reject` in a separate terminal.

### Rule Matching

Rules are evaluated in order:
1. Project-level rules (from `projects[path].rules`) take precedence over global rules
2. Within a rule set, first match wins
3. `tool` is matched exactly (case-sensitive, matches Claude Code tool name)
4. `args_match` is a regex matched against the JSON-serialised args string
5. If no rule matches, `default_tier` applies (`standard` by default)

### Module Structure

```
packages/core/src/approval/
├── types.ts      # ApprovalTier, ApprovalDecision, PendingApproval, ApprovalConfig
├── rules.ts      # classifyToolCall() — rule matching logic
├── config.ts     # loadApprovalConfig(), saveApprovalConfig()
├── store.ts      # writePending(), resolvePending(), listPending()
├── enforcer.ts   # requestApproval() — blocking/timeout/polling logic
└── index.ts      # Barrel exports
```

CLI commands in `packages/core/src/cli/approval.ts`, registered in `cli/index.ts`.

## Inherited Binding Decisions

| Decision ID | Summary | How This System Complies |
|-------------|---------|--------------------------|
| PD-001 | TypeScript as the sole language | All approval engine code is TypeScript |
| PD-002 | File-based storage (JSONL/JSON) | Pending approvals in `~/.nexus/approvals/pending.json`; config in `~/.nexus/approval.json` |
| PD-003 | Local-only deployment for v1 | All approval logic runs locally; no remote notification or webhook support in v1 |
| PD-004 | Append-only event log pattern | All approval decisions emitted as events through Core's audit trail; pending.json is mutable state (resolved entries are removed) |
| PD-005 | Git worktree for change isolation | Not directly applicable |
| PD-006 | Core and Dashboard are separate applications | Approval events visible in Dashboard via audit trail; pending queue readable by Dashboard as a future enhancement |
| PD-007 | Centralized storage in `~/.nexus/` | All approval state in `~/.nexus/approvals/`; config in `~/.nexus/approval.json` |
| CD-001 | Centralized `~/.nexus/` directory | Approval state stored in `~/.nexus/approvals/` — not per-project |
| CD-002 | Daily rotation for event logs | Approval events flow through standard audit trail with daily rotation |
| CD-003 | Agent-agnostic adapter interface | Rule matching uses tool name and args from `PreToolUse` hook — works for any agent that supports `PreToolUse` hooks |
| CD-004 | CLI-first interface | All approval operations available via `nexus approval` subcommands; no GUI required |

## Decisions

| ID | Decision | Rationale | Scope | Status | Binding |
|----|----------|-----------|-------|--------|---------|
| AP-001 | Hook exit code is the enforcement mechanism (exit 0 = allow, exit 1 = block) | Claude Code's `PreToolUse` hook natively supports blocking via non-zero exit. No IPC, no agent modification needed | System | Accepted | Yes |
| AP-002 | Pending approvals stored in `pending.json` (mutable); decisions persisted to audit trail (immutable) | Pending state needs to be mutable (entries resolved and removed). Decisions need to be immutable for auditability. Two different concerns, two different stores | System | Accepted | Yes |
| AP-003 | Hook polls `pending.json` for its own request — no IPC or sockets | Simplest reliable mechanism for hook ↔ CLI communication on Windows and Unix. Polling at 500ms intervals with a 5-second max poll cycle is imperceptible to the user | System | Accepted | Yes |
| AP-004 | First matching rule wins; project rules evaluated before global rules | Predictable, explicit precedence. Users can reason about which rule applies without complex merge logic | System | Accepted | Yes |
| AP-005 | `default_tier` is `standard` (blocking) out of the box | Safe default — users must explicitly downgrade to `constrained` or `routine`. Better to over-protect and let users relax rules than to under-protect | System | Accepted | Yes |
| AP-006 | Rejected tool calls exit 1 — Claude Code handles the error, not Nexus | Nexus should not try to interpret or recover from rejections. Claude Code will surface the hook error to the user and can decide to retry, skip, or stop | System | Accepted | Yes |

## AI Review Questions

| # | Section | Question | Answer |
|---|---------|----------|--------|
| 1 | Blocking | If the hook blocks indefinitely waiting for `nexus approve`, what happens if the user closes the terminal? | The hook process is a child of the Claude Code session. If the terminal closes, the hook process is killed, the tool call times out on Claude Code's side (Claude Code has a hook timeout), and the session continues. The pending entry in `pending.json` is left stale — a cleanup pass removes pending entries older than 1 hour on next `nexus approval queue` call. |
| 2 | Regex | `args_match` regex on serialised args is fragile — argument order or formatting changes could break rules. | Known limitation for v1. Rules should match on distinctive substrings (e.g. `"git push"`) rather than full argument structures. A future version could match on a parsed args schema. Document this clearly in the config reference. |
| 3 | Concurrency | Two concurrent sessions both hit a critical tool call. Both block, both need human approval. How does the queue UX handle this? | `nexus approval queue` lists all pending entries with session ID and project. User runs `nexus approve <id>` for each. No merging or bulk approve in v1 — each decision is explicit. |
| 4 | Performance | Polling `pending.json` at 500ms means up to 500ms latency before a human approval is detected. Is that acceptable? | Yes — the user is already context-switching to another terminal to run `nexus approve`. 500ms is imperceptible in that flow. |
| 5 | Rules | The default rule set is baked into config defaults. What if the user has no `approval.json`? | `loadApprovalConfig` returns a hardcoded default config (the rule set shown in this spec) if `approval.json` is absent. `nexus approval rules` shows the active rules regardless of whether they came from file or defaults. |
| 6 | Rejection | When a tool is rejected (exit 1), Claude Code surfaces an error. Could Claude Code then try an alternative path that bypasses the rule? | Yes — Claude Code might retry with a different tool or rephrase the request. This is intentional: Nexus blocks the specific tool call, not the agent's goal. If the agent finds a compliant path, that's fine. If the user wants to prevent the goal entirely, they should stop the session. |

## Status

`Approved`
