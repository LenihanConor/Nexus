import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setNexusDir } from "../../audit/emitter.js";
import { loadContextConfig, saveContextConfig } from "../config.js";

let tempDir: string;

beforeEach(() => {
  tempDir = join(tmpdir(), `nexus-ctx-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
  setNexusDir(tempDir);
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("loadContextConfig", () => {
  it("returns defaults when config.json is missing", async () => {
    const config = await loadContextConfig();
    expect(config.warn_at_percent).toBe(80);
    expect(config.critical_at_percent).toBe(95);
  });

  it("returns defaults when config.json is empty object", async () => {
    writeFileSync(join(tempDir, "config.json"), "{}");
    const config = await loadContextConfig();
    expect(config.warn_at_percent).toBe(80);
    expect(config.critical_at_percent).toBe(95);
  });

  it("returns defaults when context key is missing in config.json", async () => {
    writeFileSync(join(tempDir, "config.json"), JSON.stringify({ other: "value" }));
    const config = await loadContextConfig();
    expect(config.warn_at_percent).toBe(80);
    expect(config.critical_at_percent).toBe(95);
  });

  it("reads warn_at_percent and critical_at_percent correctly", async () => {
    writeFileSync(
      join(tempDir, "config.json"),
      JSON.stringify({ context: { warn_at_percent: 70, critical_at_percent: 90 } }),
    );
    const config = await loadContextConfig();
    expect(config.warn_at_percent).toBe(70);
    expect(config.critical_at_percent).toBe(90);
  });

  it("falls back to defaults when warn >= critical (warn equals critical)", async () => {
    writeFileSync(
      join(tempDir, "config.json"),
      JSON.stringify({ context: { warn_at_percent: 80, critical_at_percent: 80 } }),
    );
    const config = await loadContextConfig();
    expect(config.warn_at_percent).toBe(80);
    expect(config.critical_at_percent).toBe(95);
  });

  it("falls back to defaults when warn > critical", async () => {
    writeFileSync(
      join(tempDir, "config.json"),
      JSON.stringify({ context: { warn_at_percent: 90, critical_at_percent: 70 } }),
    );
    const config = await loadContextConfig();
    expect(config.warn_at_percent).toBe(80);
    expect(config.critical_at_percent).toBe(95);
  });

  it("logs a stderr warning when thresholds are invalid", async () => {
    const { vi } = await import("vitest");
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    writeFileSync(
      join(tempDir, "config.json"),
      JSON.stringify({ context: { warn_at_percent: 95, critical_at_percent: 80 } }),
    );
    await loadContextConfig();

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid context thresholds"));
    stderrSpy.mockRestore();
  });

  it("uses defaults for missing individual fields — only warn_at_percent present", async () => {
    writeFileSync(
      join(tempDir, "config.json"),
      JSON.stringify({ context: { warn_at_percent: 75 } }),
    );
    const config = await loadContextConfig();
    expect(config.warn_at_percent).toBe(75);
    expect(config.critical_at_percent).toBe(95);
  });

  it("uses defaults for missing individual fields — only critical_at_percent present", async () => {
    writeFileSync(
      join(tempDir, "config.json"),
      JSON.stringify({ context: { critical_at_percent: 98 } }),
    );
    const config = await loadContextConfig();
    expect(config.warn_at_percent).toBe(80);
    expect(config.critical_at_percent).toBe(98);
  });

  it("returns defaults when config.json contains invalid JSON", async () => {
    writeFileSync(join(tempDir, "config.json"), "not valid json {{");
    const config = await loadContextConfig();
    expect(config.warn_at_percent).toBe(80);
    expect(config.critical_at_percent).toBe(95);
  });
});

describe("saveContextConfig", () => {
  it("writes context config to config.json", async () => {
    await saveContextConfig({ warn_at_percent: 75, critical_at_percent: 92 });

    const raw = readFileSync(join(tempDir, "config.json"), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.context.warn_at_percent).toBe(75);
    expect(parsed.context.critical_at_percent).toBe(92);
  });

  it("merges with existing config — does not overwrite other keys", async () => {
    writeFileSync(
      join(tempDir, "config.json"),
      JSON.stringify({ budget: { hard_cap_usd: 10 }, other: "preserved" }),
    );

    await saveContextConfig({ warn_at_percent: 70, critical_at_percent: 90 });

    const raw = readFileSync(join(tempDir, "config.json"), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.budget.hard_cap_usd).toBe(10);
    expect(parsed.other).toBe("preserved");
    expect(parsed.context.warn_at_percent).toBe(70);
  });

  it("overwrites existing context key", async () => {
    writeFileSync(
      join(tempDir, "config.json"),
      JSON.stringify({ context: { warn_at_percent: 50, critical_at_percent: 60 } }),
    );

    await saveContextConfig({ warn_at_percent: 80, critical_at_percent: 95 });

    const raw = readFileSync(join(tempDir, "config.json"), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.context.warn_at_percent).toBe(80);
    expect(parsed.context.critical_at_percent).toBe(95);
  });

  it("creates config.json when it does not exist", async () => {
    await saveContextConfig({ warn_at_percent: 80, critical_at_percent: 95 });

    const raw = readFileSync(join(tempDir, "config.json"), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.context).toBeDefined();
  });

  it("round-trips through save and load", async () => {
    await saveContextConfig({ warn_at_percent: 65, critical_at_percent: 88 });
    const config = await loadContextConfig();
    expect(config.warn_at_percent).toBe(65);
    expect(config.critical_at_percent).toBe(88);
  });
});
