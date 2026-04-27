import { describe, it, expect, beforeEach } from "vitest";
import { registerAdapter, getAdapter, listAdapters } from "../registry.js";
import { GenericAdapter } from "../generic.js";
import type { AgentAdapter, AdapterStartOpts, AdapterSession, AdapterSnapshot, AdapterResult } from "../types.js";

class MockAdapter implements AgentAdapter {
  readonly agentType: string;
  constructor(type: string) { this.agentType = type; }
  async start(_opts: AdapterStartOpts): Promise<AdapterSession> { throw new Error("not implemented"); }
  async checkpoint(_session: AdapterSession, _snapshot: AdapterSnapshot): Promise<void> {}
  async end(_session: AdapterSession, _result: AdapterResult): Promise<void> {}
}

describe("adapter registry", () => {
  it("returns GenericAdapter for unknown agent type", () => {
    const adapter = getAdapter("unknown-agent-xyz");
    expect(adapter).toBeInstanceOf(GenericAdapter);
    expect(adapter.agentType).toBe("unknown-agent-xyz");
  });

  it("returns registered adapter for known agent type", () => {
    const mock = new MockAdapter("test-agent");
    registerAdapter(mock);
    const result = getAdapter("test-agent");
    expect(result).toBe(mock);
  });

  it("lists registered adapter types", () => {
    registerAdapter(new MockAdapter("agent-a"));
    registerAdapter(new MockAdapter("agent-b"));
    const types = listAdapters();
    expect(types).toContain("agent-a");
    expect(types).toContain("agent-b");
  });

  it("last registration wins for same agent type", () => {
    const first = new MockAdapter("dup-agent");
    const second = new MockAdapter("dup-agent");
    registerAdapter(first);
    registerAdapter(second);
    expect(getAdapter("dup-agent")).toBe(second);
  });
});
