# Feature Spec: CLI Orchestration Commands

## Traceability

| Level | Name | Spec |
|-------|------|------|
| Platform | Nexus | @docs/specs/platform/PLATFORM.md |
| Application | Nexus Core | @docs/specs/applications/nexus-core.md |
| System | Agent Adapter | @docs/specs/systems/nexus-core/agent-adapter.md |

## Problem Statement

The adapter lifecycle and Claude Code integration provide the programmatic machinery, but developers need a CLI command to actually use it. `nexus run` is the single entry point that wraps an agent invocation end-to-end: it creates the adapter session, spawns the agent process in the worktree, forwards signals, and cleans up when the agent exits.

## Acceptance Criteria

- [x] `nexus run <agent-type> [agent-args...]` spawns the agent wrapped in an adapter lifecycle
- [x] Required flags: `--project <path>`, `--task "description"`
- [x] Optional flags: `--branch <name>` (auto-generated from task if omitted), `--scope <paths>` (comma-separated), `--parent <session-id>`, `--correlation <id>`, `--no-worktree`, `--no-merge`, `--merge-strategy <strategy>`
- [x] Agent process spawned with `cwd` set to worktree path (or project path if `--no-worktree`)
- [x] Agent process inherits stdio (stdin, stdout, stderr) — user interacts directly with the agent
- [x] SIGINT (Ctrl+C) forwarded to agent process; adapter waits for agent exit, then runs `end(interrupted)`
- [x] SIGTERM forwarded to agent; 5-second grace period before SIGKILL
- [x] Exit code from agent determines adapter result: 0 = completed, non-zero = failed
- [x] On completed + no `--no-merge`: auto-merge worktree (default merge --no-ff)
- [x] On failed/interrupted: skip merge, leave worktree for manual inspection
- [x] `nexus run` itself exits with the agent's exit code (pass-through)
- [x] `nexus adapter hook` subcommand handles hook callbacks from Claude Code (stdin parsing, checkpoint)
- [x] Summary line printed after agent exits: session ID, status, worktree status, duration
- [x] Unit tests for runner (process spawn, signal handling, exit code mapping)

## Data Models / API

### CLI Commands

```
nexus run <agent-type> [agent-args...]
  --project <path>           Project root directory (required)
  --task <description>       Task description (required)
  --branch <name>            Worktree branch name (optional, auto-generated if omitted)
  --scope <paths>            Comma-separated scope paths (optional)
  --parent <session-id>      Parent session ID for lineage (optional)
  --correlation <id>         Correlation ID for grouping (optional)
  --no-worktree              Skip worktree creation, run in project directory
  --no-merge                 Don't auto-merge on completion
  --merge-strategy <s>       Merge strategy: merge|fast-forward|rebase (default: merge)

nexus adapter hook
  --session <id>             Session ID (required)
  --event <hookEvent>        Hook event name: PreToolUse|PostToolUse|Stop (required)
  (reads stdin JSON from Claude Code hook system)
```

### Runner (in `packages/core/src/adapter/runner.ts`)

```typescript
interface RunnerOpts {
  command: string;           // Agent command (e.g., "claude")
  args: string[];            // Agent arguments
  cwd: string;               // Working directory (worktree or project path)
  env?: Record<string, string>;  // Additional env vars
  adapter: AgentAdapter;
  session: AdapterSession;
}

interface RunnerResult {
  exitCode: number;
  signal: string | null;
  duration: number;          // milliseconds
}

async function runAgent(opts: RunnerOpts): Promise<RunnerResult>;
```

### Branch Auto-Generation

When `--branch` is omitted:
1. Slugify the task: lowercase, replace non-alphanumeric with `-`, truncate to 40 chars
2. Prefix with `feature/`: `feature/add-authentication-flow`
3. If branch exists, append counter: `feature/add-authentication-flow-2`

### Environment Variables Passed to Agent

```
NEXUS_SESSION_ID=<session-id>
NEXUS_WORKTREE_ID=<worktree-id>       (absent if --no-worktree)
NEXUS_PROJECT=<project-path>
NEXUS_BRANCH=<branch-name>            (absent if --no-worktree)
```

### Summary Output

```
───────────────────────────────────────
Nexus: session ses-abc-1234 completed
  Duration:  12m 34s
  Worktree:  merged to main (3 commits)
  Events:    8 checkpoints recorded
───────────────────────────────────────
```

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Create runner module (process spawn, signal forwarding, exit capture) | Not Started |
| 2 | Create branch auto-generation utility | Not Started |
| 3 | Add `nexus run` CLI command with all flags | Not Started |
| 4 | Add `nexus adapter hook` CLI subcommand | Not Started |
| 5 | Wire run command to adapter lifecycle (start → spawn → end) | Not Started |
| 6 | Add summary output on completion | Not Started |
| 7 | Unit tests for runner, branch generation, signal handling | Not Started |

## Open Questions

None.

## Binding Decisions Compliance

| Decision ID | Summary | How This Feature Complies |
|-------------|---------|---------------------------|
| PD-001 | TypeScript only | CLI command and runner are TypeScript |
| PD-003 | Local-only deployment | Agent spawned as local child process |
| PD-005 | Git worktree isolation | Agent cwd is set to worktree path |
| CD-004 | CLI-first | `nexus run` is the primary user-facing command for the adapter system |
| AA-001 | No direct file access | Run command orchestrates through adapter which uses Core APIs |
| AA-004 | Agent inherits stdio | `stdio: "inherit"` on child process — user interacts directly with agent |

## AI Review Questions

| # | Section | Question | Suggested Default | Answer |
|---|---------|----------|-------------------|--------|
| 1 | Process | On Windows, SIGINT forwarding to child processes is unreliable. How does Ctrl+C work? | Use `process.kill(pid)` on Windows; it sends SIGTERM equivalent | On Windows, Ctrl+C is delivered to the entire console process group. The agent (as a child process) receives it directly from the OS — no forwarding needed. The adapter listens for its own SIGINT to know the user pressed Ctrl+C, waits for the child to exit, then runs cleanup. If the child doesn't exit within 5s, use `process.kill(pid)`. |
| 2 | Agent Types | What command does each agent type map to? | Lookup table: `claude-code` → `claude`, `aider` → `aider`, `cursor` → not applicable | The adapter registry holds default commands: `claude-code` → `claude`, `aider` → `aider`. For agents without a CLI (Cursor), `nexus run` isn't applicable — they'd use `GenericAdapter` via a different integration path. The `<agent-type>` argument also accepts a raw command for unlisted agents. |
| 3 | Branch | Auto-generated branch names could collide with existing remote branches. Check remote? | Check local branches only; remote collisions are the user's problem | Check local branches only via `git branch --list`. Remote branch collisions are resolved at push time by the user, which is normal git workflow. |
| 4 | Env Vars | Should env vars use a `NEXUS_` prefix to avoid conflicts? | Yes | Yes. All Nexus-injected env vars use the `NEXUS_` prefix: `NEXUS_SESSION_ID`, `NEXUS_WORKTREE_ID`, `NEXUS_PROJECT`, `NEXUS_BRANCH`. |
| 5 | Error | What if the agent command doesn't exist (e.g., `claude` not installed)? | Fail fast with clear error before creating session | The runner checks for the command via `which`/`where` before calling `adapter.start()`. If not found: print `Error: 'claude' not found. Install Claude Code or provide the full path.` and exit 1. No session or worktree is created. |

## Status

`Done`
