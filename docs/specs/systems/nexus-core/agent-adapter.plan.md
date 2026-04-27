# Plan: Agent Adapter

**Spec:** @docs/specs/systems/nexus-core/agent-adapter.md
**Status:** Done
**Started:** 2026-04-27
**Last Updated:** 2026-04-27

## Implementation Patterns

### Module Structure

All adapter code lives in `packages/core/src/adapter/`:
- `types.ts` — All interfaces: `AgentAdapter`, `AdapterStartOpts`, `AdapterSession`, `AdapterSnapshot`, `AdapterResult`
- `base.ts` — `BaseAdapter` class implementing common lifecycle via Core APIs
- `generic.ts` — `GenericAdapter` extends BaseAdapter with no overrides
- `claude-code.ts` — `ClaudeCodeAdapter` extends BaseAdapter, adds hook install/remove
- `hooks.ts` — Hook config generation, merging, removal, stdin parsing
- `registry.ts` — Adapter registry with `registerAdapter`/`getAdapter`/`listAdapters`
- `runner.ts` — Process spawning, signal forwarding, exit capture
- `index.ts` — Barrel exports

### CLI Commands

- `nexus run` — in `packages/core/src/cli/run.ts`, registered in `cli/index.ts`
- `nexus adapter hook` — in `packages/core/src/cli/adapter.ts`, registered in `cli/index.ts`

### Patterns

- BaseAdapter calls `createSession`/`updateSession`/`endSession` from `../session/lifecycle.js`
- BaseAdapter calls `createWorktree`/`mergeWorktree` from `../worktree/lifecycle.js`
- Hook config written to `.claude/settings.local.json` (gitignored)
- Hook commands use absolute path to `nexus` binary resolved via `process.argv[0]` or `which`
- Runner uses `child_process.spawn` with `stdio: "inherit"`
- Tests in `packages/core/src/adapter/__tests__/`

## Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Feature: Adapter Lifecycle (types, base, generic, registry, exports) | Done | types.ts, base.ts, generic.ts, registry.ts, index.ts |
| 2 | Feature: Claude Code Integration (hooks, claude-code adapter, CLI handler) | Done | hooks.ts, claude-code.ts, cli/adapter.ts |
| 3 | Feature: CLI Orchestration (runner, nexus run command, wiring) | Done | runner.ts, cli/run.ts |
| 4 | Export adapter APIs from packages/core/src/index.ts | Done | All types and functions exported |
| 5 | Tests for all three features | Done | 33 new tests: base (11), registry (4), hooks+runner (18) |
| 6 | Build + verify | Done | 293/293 tests pass, clean tsc build |

## Session Notes

### 2026-04-27
- Implemented all 3 features in one pass
- 8 new files in packages/core/src/adapter/: types, base, generic, claude-code, hooks, registry, runner, index
- 2 new CLI commands in packages/core/src/cli/: run.ts (nexus run), adapter.ts (nexus adapter hook)
- 33 new tests across 3 test files, all pass
- Full suite: 293/293 pass, clean build
