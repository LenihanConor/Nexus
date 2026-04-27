import type { AgentAdapter } from "./types.js";
import { GenericAdapter } from "./generic.js";

const adapters = new Map<string, AgentAdapter>();

export function registerAdapter(adapter: AgentAdapter): void {
  adapters.set(adapter.agentType, adapter);
}

export function getAdapter(agentType: string): AgentAdapter {
  return adapters.get(agentType) ?? new GenericAdapter(agentType);
}

export function listAdapters(): string[] {
  return [...adapters.keys()];
}
