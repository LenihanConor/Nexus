import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setNexusDir } from "../../audit/emitter.js";
import { appendUsageRecord, listUsageRecords, getUsageStorePath, resetStoreDirCache } from "../store.js";
import type { UsageRecord } from "@nexus/shared";

let tempDir: string;

function makeRecord(overrides: Partial<UsageRecord> & { project: string; session_id: string }): UsageRecord {
  return {
    id: Math.random().toString(36).slice(2),
    agent_type: "claude-code",
    timestamp: new Date().toISOString(),
    model: "claude-sonnet-4-6",
    input_tokens: 100,
    output_tokens: 50,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
    estimated_cost_usd: 0.001,
    ...overrides,
  };
}

beforeEach(() => {
  tempDir = join(tmpdir(), `nexus-budget-store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
  setNexusDir(tempDir);
  resetStoreDirCache();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  resetStoreDirCache();
});

describe("getUsageStorePath", () => {
  it("returns path under nexusDir/usage/usage.jsonl", () => {
    const storePath = getUsageStorePath();
    expect(storePath).toBe(join(tempDir, "usage", "usage.jsonl"));
  });
});

describe("appendUsageRecord", () => {
  it("writes a record to the file", async () => {
    const record = makeRecord({ id: "r1", project: "C:/proj", session_id: "s1" });
    await appendUsageRecord(record);

    const results = await listUsageRecords();
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe("r1");
  });

  it("creates the usage directory if it does not exist", async () => {
    const { existsSync } = await import("node:fs");
    const usageDir = join(tempDir, "usage");
    expect(existsSync(usageDir)).toBe(false);

    await appendUsageRecord(makeRecord({ project: "proj", session_id: "s1" }));
    expect(existsSync(usageDir)).toBe(true);
  });

  it("appends multiple records to the same file", async () => {
    await appendUsageRecord(makeRecord({ id: "r1", project: "proj", session_id: "s1" }));
    await appendUsageRecord(makeRecord({ id: "r2", project: "proj", session_id: "s2" }));
    await appendUsageRecord(makeRecord({ id: "r3", project: "proj", session_id: "s3" }));

    const results = await listUsageRecords();
    expect(results).toHaveLength(3);
  });
});

describe("listUsageRecords", () => {
  it("returns empty array when file does not exist", async () => {
    const results = await listUsageRecords();
    expect(results).toEqual([]);
  });

  it("returns empty array for empty file", async () => {
    const { writeFileSync } = await import("node:fs");
    const { mkdirSync } = await import("node:fs");
    mkdirSync(join(tempDir, "usage"), { recursive: true });
    writeFileSync(getUsageStorePath(), "");

    const results = await listUsageRecords();
    expect(results).toEqual([]);
  });

  it("reads records back with correct data", async () => {
    const record = makeRecord({
      id: "test-id",
      project: "C:/Projects/foo",
      session_id: "s-abc",
      model: "claude-opus-4-7",
      input_tokens: 500,
      output_tokens: 200,
      estimated_cost_usd: 0.015,
    });

    await appendUsageRecord(record);
    const results = await listUsageRecords();
    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(r.id).toBe("test-id");
    expect(r.project).toBe("C:/Projects/foo");
    expect(r.session_id).toBe("s-abc");
    expect(r.model).toBe("claude-opus-4-7");
    expect(r.input_tokens).toBe(500);
    expect(r.output_tokens).toBe(200);
    expect(r.estimated_cost_usd).toBe(0.015);
  });

  it("derives last-write-wins by id (upsert semantics)", async () => {
    const r1 = makeRecord({ id: "dup-id", project: "proj", session_id: "s1", estimated_cost_usd: 0.001 });
    const r2 = { ...r1, estimated_cost_usd: 0.002 };
    await appendUsageRecord(r1);
    await appendUsageRecord(r2);

    const results = await listUsageRecords();
    expect(results).toHaveLength(1);
    expect(results[0]!.estimated_cost_usd).toBe(0.002);
  });

  it("sorts results by timestamp descending", async () => {
    await appendUsageRecord(makeRecord({ id: "r1", project: "proj", session_id: "s1", timestamp: "2026-04-01T10:00:00.000Z" }));
    await appendUsageRecord(makeRecord({ id: "r2", project: "proj", session_id: "s2", timestamp: "2026-04-03T10:00:00.000Z" }));
    await appendUsageRecord(makeRecord({ id: "r3", project: "proj", session_id: "s3", timestamp: "2026-04-02T10:00:00.000Z" }));

    const results = await listUsageRecords();
    expect(results[0]!.id).toBe("r2");
    expect(results[1]!.id).toBe("r3");
    expect(results[2]!.id).toBe("r1");
  });

  it("filters by project", async () => {
    await appendUsageRecord(makeRecord({ id: "r1", project: "C:/ProjectA", session_id: "s1" }));
    await appendUsageRecord(makeRecord({ id: "r2", project: "C:/ProjectB", session_id: "s2" }));

    const results = await listUsageRecords({ project: "C:/ProjectA" });
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe("r1");
  });

  it("filters by session_id", async () => {
    await appendUsageRecord(makeRecord({ id: "r1", project: "proj", session_id: "sess-target" }));
    await appendUsageRecord(makeRecord({ id: "r2", project: "proj", session_id: "sess-other" }));
    await appendUsageRecord(makeRecord({ id: "r3", project: "proj", session_id: "sess-target" }));

    const results = await listUsageRecords({ session_id: "sess-target" });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.session_id === "sess-target")).toBe(true);
  });

  it("filters by from (inclusive)", async () => {
    await appendUsageRecord(makeRecord({ id: "r1", project: "proj", session_id: "s1", timestamp: "2026-04-01T00:00:00.000Z" }));
    await appendUsageRecord(makeRecord({ id: "r2", project: "proj", session_id: "s2", timestamp: "2026-04-10T00:00:00.000Z" }));
    await appendUsageRecord(makeRecord({ id: "r3", project: "proj", session_id: "s3", timestamp: "2026-04-20T00:00:00.000Z" }));

    const results = await listUsageRecords({ from: "2026-04-10T00:00:00.000Z" });
    expect(results.map((r) => r.id).sort()).toEqual(["r2", "r3"].sort());
  });

  it("filters by to (inclusive)", async () => {
    await appendUsageRecord(makeRecord({ id: "r1", project: "proj", session_id: "s1", timestamp: "2026-04-01T00:00:00.000Z" }));
    await appendUsageRecord(makeRecord({ id: "r2", project: "proj", session_id: "s2", timestamp: "2026-04-10T00:00:00.000Z" }));
    await appendUsageRecord(makeRecord({ id: "r3", project: "proj", session_id: "s3", timestamp: "2026-04-20T00:00:00.000Z" }));

    const results = await listUsageRecords({ to: "2026-04-10T00:00:00.000Z" });
    expect(results.map((r) => r.id).sort()).toEqual(["r1", "r2"].sort());
  });

  it("filters by from and to together", async () => {
    await appendUsageRecord(makeRecord({ id: "r1", project: "proj", session_id: "s1", timestamp: "2026-04-01T00:00:00.000Z" }));
    await appendUsageRecord(makeRecord({ id: "r2", project: "proj", session_id: "s2", timestamp: "2026-04-10T00:00:00.000Z" }));
    await appendUsageRecord(makeRecord({ id: "r3", project: "proj", session_id: "s3", timestamp: "2026-04-20T00:00:00.000Z" }));

    const results = await listUsageRecords({
      from: "2026-04-05T00:00:00.000Z",
      to: "2026-04-15T00:00:00.000Z",
    });
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe("r2");
  });

  it("filters by project and session_id together", async () => {
    await appendUsageRecord(makeRecord({ id: "r1", project: "C:/A", session_id: "s-x" }));
    await appendUsageRecord(makeRecord({ id: "r2", project: "C:/B", session_id: "s-x" }));
    await appendUsageRecord(makeRecord({ id: "r3", project: "C:/A", session_id: "s-y" }));

    const results = await listUsageRecords({ project: "C:/A", session_id: "s-x" });
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe("r1");
  });
});
