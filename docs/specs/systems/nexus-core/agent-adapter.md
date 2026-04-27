# System Spec: Agent Adapter

## Parent Application

@docs/specs/applications/nexus-core.md

## Purpose

The Agent Adapter system is the bridge between CLI-LLM tools and Nexus Core's infrastructure. It owns the full lifecycle of wrapping an agent invocation — registering a session, creating an isolated worktree, emitting audit events throughout execution, and cleaning up on completion. The adapter is agent-agnostic at the interface level: a common `AgentAdapter` contract defines the lifecycle, and agent-specific implementations provide the integration hooks for each tool (Claude Code first, then Cursor, Aider, etc.).

This is what makes Nexus data **real** — without it, Core's session registry, audit trail, and worktree isolation are infrastructure with no data flowing through them. The adapter is the producer.

## Features

| Feature | Description | Spec | Status |
|---------|-------------|------|--------|
| Adapter Lifecycle | Common adapter interface — `start`, `checkpoint`, `end` — that orchestrates session + worktree + audit calls for any agent | @docs/specs/features/nexus-core/agent-adapter/adapter-lifecycle.md | Done |
| Claude Code Integration | First agent-specific adapter: uses Claude Code hooks (`PreToolUse`, `PostToolUse`, `Stop`) to emit events and capture progress without modifying the agent | @docs/specs/features/nexus-core/agent-adapter/claude-code-integration.md | Done |
| CLI Orchestration Commands | `nexus run` command that wraps an agent invocation end-to-end: adapter start → spawn agent → monitor → adapter end | @docs/specs/features/nexus-core/agent-adapter/cli-orchestration.md | Done |

## Public Interfaces

### AgentAdapter Interface

```typescript
interface AgentAdapter {
  /** Unique agent type identifier (e.g., "claude-code", "aider") */
  readonly agentType: string;

  /** Start a wrapped agent session — creates session, worktree, emits start event */
  start(opts: AdapterStartOpts): Promise<AdapterSession>;

  /** Record a progress checkpoint mid-session */
  checkpoint(session: AdapterSession, snapshot: AdapterSnapshot): Promise<void>;

  /** End the session — update status, merge/cleanup worktree, emit end event */
  end(session: AdapterSession, result: AdapterResult): Promise<void>;
}

interface AdapterStartOpts {
  project: string;
  branch: string;
  task: string;
  scope?: string[];
  parentSessionId?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

interface AdapterSession {
  sessionId: string;
  worktreeId: string;
  worktreePath: string;
  project: string;
  branch: string;
  agentType: string;
  agentPid?: number;
  startedAt: string;
}

interface AdapterSnapshot {
  label: string;
  taskProgress?: string;
  filesChanged?: string[];
  decisions?: string[];
  tokenCount?: number;
  contextWindowPercent?: number;
  notes?: string;
}

interface AdapterResult {
  status: "completed" | "failed" | "interrupted";
  exitCode?: number;
  mergeStrategy?: "merge" | "fast-forward" | "rebase" | "skip";
  snapshot?: AdapterSnapshot;
  metadata?: Record<string, unknown>;
}
```

### CLI Commands

| Command | Description |
|---------|-------------|
| `nexus run <agent> [args...]` | Wrap an agent invocation end-to-end |
| `nexus run --project <path> --branch <name> --task "description" claude-code [args...]` | Full form with all options |

### Events Emitted

The adapter emits standard session and worktree events through Core's existing audit trail. No new event types are needed — `session.started`, `session.updated`, `session.ended`, `worktree.created`, `worktree.merged`, `worktree.cleaned` already cover the lifecycle. Agent-specific enrichment goes into event `payload.metadata`.

### Hook Integration (Claude Code)

Claude Code hooks are JSON config files that register shell commands to run on agent events. The adapter installs temporary hook config that calls back into Nexus:

```
Claude Code Event          →  Nexus Action
─────────────────────────────────────────────
SessionStart               →  (handled by adapter.start)
PreToolUse [Write/Edit]    →  checkpoint with files_changed
PostToolUse [Bash]         →  checkpoint with command context
Stop                       →  adapter.end
```

## Dependencies

| Dependency | What This System Uses |
|-----------|----------------------|
| Session Registry | `createSession`, `updateSession`, `endSession` — session lifecycle |
| Worktree Isolation | `createWorktree`, `mergeWorktree`, `cleanupWorktree` — worktree lifecycle |
| Audit Trail | `emitEvent` — event emission (indirectly, via session and worktree calls) |
| `packages/shared` | `SessionRecord`, `WorktreeRecord`, `NexusEvent` types |

## Architecture

### Data Flow

```
nexus run claude-code --task "Add auth flow" --branch feature/add-auth
    │
    ├── 1. adapter.start()
    │       ├── createSession()         → sessions.jsonl
    │       ├── createWorktree()        → worktrees.jsonl
    │       └── emitEvent(session.started, worktree.created)  → events-*.jsonl
    │
    ├── 2. Spawn agent process in worktree directory
    │       └── Agent runs with hooks installed
    │
    ├── 3. Hooks fire during execution
    │       ├── PreToolUse [Write]  → adapter.checkpoint(files_changed)
    │       ├── PostToolUse [Bash]  → adapter.checkpoint(command_context)
    │       └── Each checkpoint     → updateSession() + emitEvent(session.updated)
    │
    ├── 4. Agent exits (or crashes)
    │       └── adapter.end()
    │           ├── endSession(completed|failed|interrupted)
    │           ├── mergeWorktree() or leave for manual merge
    │           └── emitEvent(session.ended, worktree.merged)
    │
    └── Dashboard sees all of this via its normal 5-second polling
```

### Agent Process Management

The adapter spawns the agent as a child process with:
- `cwd` set to the worktree path (agent works in isolation)
- `stdio: "inherit"` (agent's terminal I/O passes through to user)
- Signal forwarding (SIGINT/SIGTERM from user → agent process)
- Exit code capture for result status

### Crash Recovery

If the adapter or agent crashes mid-session:
1. Session is left in `running` state with a valid `agent_pid`
2. Core's existing stale session detection finds it (PID is dead → mark `interrupted`)
3. Worktree is left in `active` state → stale worktree detection catches it
4. User runs `nexus session clean --stale` / `nexus worktree clean --stale` to clean up
5. No data is lost — the append-only audit trail has every checkpoint up to the crash

### Claude Code Hook Mechanics

Claude Code hooks are configured via `.claude/settings.json` (project-level, shareable), `.claude/settings.local.json` (project-level, gitignored), or `~/.claude/settings.json` (user-level). The adapter writes hooks into the worktree's `.claude/settings.local.json` so they are never committed:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "/abs/path/to/nexus adapter hook --session SESSION_ID --event PreToolUse",
            "timeout": 5
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/abs/path/to/nexus adapter hook --session SESSION_ID --event PostToolUse",
            "timeout": 5
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/abs/path/to/nexus adapter hook --session SESSION_ID --event Stop",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

Hook commands receive context via stdin (JSON with tool name, input, output per Claude Code's hook protocol). The adapter parses this to extract `files_changed`, decisions, and other enrichment. Commands use absolute paths to the `nexus` binary to avoid PATH issues across shell environments.

### Agent-Agnostic Design

```
┌──────────────────────────────────────────┐
│          AgentAdapter (interface)          │
│  start() / checkpoint() / end()           │
└──────────┬───────────────────────────────┘
           │
    ┌──────┴──────────────────────┐
    │                             │
┌───┴───────────┐    ┌───────────┴───────┐
│ ClaudeCodeAdapter │ │ GenericAdapter      │
│ - Installs hooks  │ │ - No hooks          │
│ - Parses stdin    │ │ - Manual checkpoints│
│ - Rich telemetry  │ │ - Basic lifecycle   │
└───────────────────┘ └─────────────────────┘
```

`GenericAdapter` provides the minimum: session + worktree lifecycle, no agent-specific enrichment. Agents that don't support hooks still get isolation and audit trailing.

## Implementation Patterns

### Module Structure

```
packages/core/src/adapter/
├── types.ts              # AgentAdapter, AdapterSession, AdapterStartOpts, etc.
├── base.ts               # BaseAdapter — shared lifecycle logic (calls session + worktree APIs)
├── claude-code.ts        # ClaudeCodeAdapter — hook installation, stdin parsing
├── generic.ts            # GenericAdapter — no hooks, basic lifecycle
├── registry.ts           # Adapter registry — getAdapter(agentType)
├── runner.ts             # Process spawning, signal forwarding, exit capture
└── index.ts              # Barrel exports
```

### Key Patterns

- **BaseAdapter** implements the common lifecycle: `start` calls `createSession` + `createWorktree`, `end` calls `endSession` + optionally `mergeWorktree`. Agent-specific adapters extend it.
- **Runner** owns process spawning and monitoring — separate from adapter logic so it can be tested independently.
- **Hook config is temporary** — written to the worktree's `.claude/` directory before agent starts, cleaned up after agent ends. Does not pollute the user's project.
- **stdin JSON parsing** — Claude Code hooks receive tool context as JSON on stdin. The adapter reads and parses this in the hook command handler.

## Inherited Binding Decisions

| Decision ID | Summary | How This System Complies |
|-------------|---------|--------------------------|
| PD-001 | TypeScript as the sole language | All adapter code is TypeScript |
| PD-002 | File-based storage (JSONL/JSON) | No new storage — adapter writes through Session Registry and Audit Trail which use JSONL |
| PD-003 | Local-only deployment for v1 | Adapter runs locally, spawns local agent processes |
| PD-004 | Append-only event log pattern | Adapter emits events through Core's existing `emitEvent` — no direct file writes |
| PD-005 | Git worktree for change isolation | Adapter creates a worktree per agent session via Core's Worktree Isolation system |
| PD-006 | Core and Dashboard are separate apps | Adapter is a Core system; Dashboard sees its data through normal polling |
| PD-007 | Centralized storage in `~/.nexus/` | All data flows through Core's existing storage layer in `~/.nexus/` |
| CD-001 | Centralized `~/.nexus/` directory | Adapter state stored in existing session/worktree/event files — no new storage locations |
| CD-002 | Daily rotation for event logs | Events emitted by adapter go through the standard daily-rotated audit trail |
| CD-003 | Agent-agnostic adapter interface | This system directly implements this decision — common `AgentAdapter` interface with agent-specific subclasses |
| CD-004 | CLI-first interface | `nexus run` is a CLI command; all adapter operations available via CLI |

## Decisions

| ID | Decision | Rationale | Scope | Status | Binding |
|----|----------|-----------|-------|--------|---------|
| AA-001 | Adapter writes through existing Core APIs, no direct file access | Single responsibility: adapter orchestrates, session/worktree/audit systems own their data. Prevents bypassing validation, rotation, and deduplication logic | System | Accepted | Yes |
| AA-002 | Hook config is temporary and scoped to the worktree | Adapter must not modify the user's project directory or global Claude Code config. Worktree is ephemeral — safe to write hooks there | System | Accepted | Yes |
| AA-003 | GenericAdapter as fallback for unsupported agents | Any agent can get basic session + worktree lifecycle without hooks. Enriched adapters (Claude Code) layer on top. This fulfils CD-003 | System | Accepted | Yes |
| AA-004 | Agent process inherits stdio | The adapter wraps the agent, not replaces it. User still interacts with the agent directly. Nexus is invisible except for the orchestration | System | Accepted | Yes |
| AA-005 | Crash recovery deferred to existing stale detection | No new crash recovery mechanism. Core's session and worktree stale detectors already handle this case. Adapter just needs to record agent_pid | System | Accepted | No |

## AI Review Questions

| # | Section | Question | Answer |
|---|---------|----------|--------|
| 1 | Hooks | Claude Code hooks receive context on stdin — what if the hook command takes too long and blocks the agent? | Claude Code hooks have a default timeout (typically 10s). The checkpoint handler must be fast: write to a local socket or fire-and-forget a subprocess. Avoid synchronous JSONL appends in the hot path — queue them. |
| 2 | Hooks | What if the user already has `.claude/hooks.json` in their project? The adapter writes to the worktree copy, but does Claude Code merge project + user hooks? | Claude Code merges hooks from multiple sources (project `.claude/hooks.json`, user `~/.claude/hooks.json`). Since the worktree is a copy of the project, any existing project hooks are already there. The adapter should merge its hooks into the existing config, not overwrite it. |
| 3 | Process | What if the user Ctrl+C's the `nexus run` command? Does the agent get killed cleanly? | The runner sets up signal handlers: SIGINT → forward to agent process → wait for exit → adapter.end(interrupted). On Windows, use `process.kill(pid)` since SIGINT forwarding is unreliable. Add a 5-second grace period before force-killing. |
| 4 | Scope | Should `nexus run` be required, or can the adapter work retroactively with already-running agents? | v1 requires `nexus run` — the adapter must control the process lifecycle to guarantee start/end events. Retroactive attachment (connecting to an existing agent PID) is a future enhancement that would need IPC or file-watching. |
| 5 | Worktree | What if the user doesn't want worktree isolation for a task (e.g., quick fix on main)? | `nexus run --no-worktree` skips worktree creation. Session is still registered and events still emitted, but the agent runs in the project directory directly. The adapter lifecycle still works — just no worktree start/end calls. |
| 6 | Merge | Should the adapter auto-merge on successful completion, or always leave it for the user? | Default: auto-merge on success (`status: completed`). Skip merge on failure or interruption. User can override with `--no-merge` flag. Auto-merge uses the default strategy (merge --no-ff) unless `--merge-strategy` is specified. |

## Status

`Done`
