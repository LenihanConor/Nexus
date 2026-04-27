# Feature Spec: Claude Code Integration

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Core | @docs/specs/applications/nexus-core.md |
| System | Agent Adapter | @docs/specs/systems/nexus-core/agent-adapter.md |

## Problem Statement

Claude Code is the primary CLI-LLM tool for this project. Without agent-specific integration, Nexus can only capture session start/end — missing the rich mid-session activity (file edits, bash commands, decisions) that makes the audit trail and dashboard actually useful. Claude Code's hook system provides the integration point: shell commands that fire on every tool use, receiving full context via stdin JSON.

## Acceptance Criteria

- [x] `ClaudeCodeAdapter` extends BaseAdapter with hook installation and removal
- [x] Before spawning Claude Code, adapter writes Nexus hooks into the worktree's `.claude/settings.local.json`
- [x] Hooks are merged with any existing `.claude/settings.local.json` in the worktree — never overwrite
- [x] Hook config uses `settings.local.json` (not `settings.json`) so it is gitignored and never committed
- [x] Hooks installed: `PreToolUse` (Write/Edit/MultiEdit), `PostToolUse` (Bash), `Stop`, `PostToolUse` (Read/Glob/Grep for file tracking)
- [x] Hook commands call a Nexus CLI handler: `nexus adapter hook --session <id> --event <hookEvent>`
- [x] Hook handler reads stdin JSON, extracts relevant fields, calls `adapter.checkpoint()`
- [x] `PreToolUse` on Write/Edit captures `tool_input.file_path` → `filesChanged` in snapshot
- [x] `PostToolUse` on Bash captures `tool_input.command` → snapshot notes
- [x] `Stop` event triggers a final checkpoint marking session end
- [x] Hook timeout set to 5 seconds — fast fire-and-forget, must not block the agent
- [x] After agent exits, adapter removes Nexus hooks from `.claude/settings.local.json`
- [x] If cleanup fails (crash), stale hooks are harmless — they reference a dead session ID
- [x] Unit tests for hook config generation, merging, and stdin parsing

## Data Models / API

### ClaudeCodeAdapter (in `packages/core/src/adapter/claude-code.ts`)

```typescript
class ClaudeCodeAdapter extends BaseAdapter {
  readonly agentType = "claude-code";

  /** Installs hooks into worktree, then delegates to BaseAdapter.start() */
  async start(opts: AdapterStartOpts): Promise<AdapterSession>;

  /** Removes hooks from worktree, then delegates to BaseAdapter.end() */
  async end(session: AdapterSession, result: AdapterResult): Promise<void>;
}
```

### Hook Config Shape

Written to `<worktree>/.claude/settings.local.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "nexus adapter hook --session SESSION_ID --event PreToolUse",
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
            "command": "nexus adapter hook --session SESSION_ID --event PostToolUse",
            "timeout": 5
          }
        ]
      },
      {
        "matcher": "Read|Glob|Grep",
        "hooks": [
          {
            "type": "command",
            "command": "nexus adapter hook --session SESSION_ID --event PostToolUse",
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
            "command": "nexus adapter hook --session SESSION_ID --event Stop",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

### Hook Handler CLI (in `packages/core/src/cli/adapter.ts`)

```typescript
// nexus adapter hook --session <id> --event <hookEvent>
// Reads stdin JSON, parses tool context, calls adapter.checkpoint()
```

### Stdin Parsing

| Hook Event | Tool | Extracted Fields |
|-----------|------|-----------------|
| PreToolUse | Write/Edit/MultiEdit | `tool_input.file_path` → `filesChanged[]` |
| PostToolUse | Bash | `tool_input.command` → `notes`, `tool_input.description` → `label` |
| PostToolUse | Read/Glob/Grep | `tool_name` → tracked as read activity (notes) |
| Stop | — | Final checkpoint, `stop_reason` if available |

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Create hook config generator (builds settings.local.json content with session ID) | Not Started |
| 2 | Create hook config installer (merge into existing settings.local.json in worktree) | Not Started |
| 3 | Create hook config remover (strip Nexus hooks on cleanup) | Not Started |
| 4 | Create stdin parser for each hook event type | Not Started |
| 5 | Create ClaudeCodeAdapter extending BaseAdapter | Not Started |
| 6 | Add `nexus adapter hook` CLI subcommand | Not Started |
| 7 | Unit tests for config generation, merging, stdin parsing | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript only | All adapter code is TypeScript; hook commands call `nexus` CLI (also TypeScript) |
| PD-004 | Append-only event log | Checkpoints emit events via Core's audit trail |
| PD-005 | Git worktree isolation | Hooks are installed in the worktree directory, not the source project |
| CD-003 | Agent-agnostic interface | ClaudeCodeAdapter implements the same `AgentAdapter` interface as GenericAdapter |
| CD-004 | CLI-first | Hook handler is a CLI subcommand (`nexus adapter hook`) |
| AA-001 | No direct file access for data | Adapter writes only hook config (settings.local.json); all Nexus data goes through Core APIs |
| AA-002 | Hook config is temporary and scoped to worktree | Written to `<worktree>/.claude/settings.local.json`; removed on end; uses `.local.json` so it's gitignored |
| AA-004 | Agent inherits stdio | Claude Code runs with inherited stdio; hooks are non-blocking side-channel |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Hooks | What if `nexus` CLI is not on PATH when hooks fire? Claude Code may have a different shell environment. | Use absolute path to nexus binary | Hook commands use the absolute path resolved at install time: `<abs-path-to-nexus> adapter hook --session ...`. This avoids PATH issues across shell environments. |
| 2 | Hooks | Claude Code hooks have a 3-level nesting (`hooks.EventName[].hooks[]`). The system spec showed a flat format. Is the spec correct? | Update to match real format | Updated. The hook config in this feature spec uses the correct 3-level format: `hooks → EventName → [{ matcher, hooks: [{ type, command, timeout }] }]`. |
| 3 | Performance | Each hook fires a `nexus adapter hook` subprocess. That's a Node.js cold start per hook call. Is this too slow? | Acceptable at 5s timeout; Node starts in ~100ms | Node.js startup is ~50-150ms. The hook handler reads stdin, makes one JSONL append (via `updateSession`), and exits. Total time well under 1 second. The 5s timeout is conservative. If this becomes a bottleneck, a future optimization is a long-running Nexus daemon with a Unix socket. |
| 4 | Merge | What if the worktree already has `.claude/settings.local.json` with user hooks? | Deep merge, don't overwrite | The installer reads any existing `settings.local.json`, deep-merges Nexus hooks into the `hooks` object (appending to existing event arrays), and writes back. On removal, it strips only the Nexus-added entries (identified by the `--session SESSION_ID` in the command string). |
| 5 | Scope | Should we hook into `SessionStart` / `SessionEnd` Claude Code events? | No — adapter.start/end already covers this | Correct. The adapter's `start()` and `end()` handle session lifecycle. Hooking `SessionStart`/`SessionEnd` would create duplicate events. We only hook mid-session events that the adapter can't otherwise observe. |

## Status

`Done`
