export type {
  AgentAdapter,
  AdapterStartOpts,
  AdapterSession,
  AdapterSnapshot,
  AdapterResult,
} from "./types.js";

export { BaseAdapter } from "./base.js";
export { GenericAdapter } from "./generic.js";
export { ClaudeCodeAdapter } from "./claude-code.js";
export { registerAdapter, getAdapter, listAdapters } from "./registry.js";
export { runAgent, mapExitToStatus } from "./runner.js";
export type { RunnerOpts, RunnerResult } from "./runner.js";
export {
  generateHookConfig,
  installHooks,
  removeHooks,
  parseHookStdin,
} from "./hooks.js";
export type { HookInput, ParsedHookData } from "./hooks.js";
export { autoStart, autoCheckpoint, autoEnd } from "./auto.js";
