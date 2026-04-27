import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { setNexusDir } from "../../audit/emitter.js";
import {
  addPending,
  listPending,
  resolvePending,
  cleanStalePending,
  writeResolution,
  readResolution,
  clearResolution,
  resetStoreDirCache,
  readPending,
  writePending,
} from "../store.js";
import type { PendingApproval, ResolvedApproval } from "@nexus/shared";

let tempDir: string;

beforeEach(() => {
  tempDir = join(
    tmpdir(),
    `nexus-approval-store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(tempDir, { recursive: true });
  setNexusDir(tempDir);
  resetStoreDirCache();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function makePending(overrides?: Partial<PendingApproval>): PendingApproval {
  return {
    id: randomUUID(),
    session_id: "sess-1",
    project: "C:/GitHub/Test",
    tool: "Write",
    args: {},
    tier: "constrained",
    requested_at: new Date().toISOString(),
    timeout_at: null,
    ...overrides,
  };
}

describe("readPending / writePending", () => {
  it("returns empty array when pending.json does not exist", async () => {
    const result = await readPending();
    expect(result).toEqual([]);
  });

  it("round-trips entries through writePending / readPending", async () => {
    const entry = makePending();
    await writePending([entry]);
    const result = await readPending();
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(entry.id);
  });
});

describe("addPending", () => {
  it("adds an entry to the pending store", async () => {
    const entry = makePending();
    await addPending(entry);
    const result = await listPending();
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(entry.id);
  });

  it("adds multiple entries sequentially", async () => {
    const e1 = makePending({ tool: "Write" });
    const e2 = makePending({ tool: "Edit" });
    await addPending(e1);
    await addPending(e2);
    const result = await listPending();
    expect(result).toHaveLength(2);
  });
});

describe("listPending", () => {
  it("returns all pending entries", async () => {
    await addPending(makePending());
    await addPending(makePending());
    await addPending(makePending());
    const result = await listPending();
    expect(result).toHaveLength(3);
  });

  it("returns empty array when no entries", async () => {
    const result = await listPending();
    expect(result).toEqual([]);
  });
});

describe("resolvePending", () => {
  it("removes the entry and returns it", async () => {
    const entry = makePending();
    await addPending(entry);

    const resolution: ResolvedApproval = { approved: true, resolved_at: new Date().toISOString() };
    const returned = await resolvePending(entry.id, resolution);
    expect(returned?.id).toBe(entry.id);

    const remaining = await listPending();
    expect(remaining).toHaveLength(0);
  });

  it("returns null for unknown id", async () => {
    const result = await resolvePending("nonexistent-id", {
      approved: true,
      resolved_at: new Date().toISOString(),
    });
    expect(result).toBeNull();
  });

  it("removes only the specified entry", async () => {
    const e1 = makePending({ tool: "Write" });
    const e2 = makePending({ tool: "Edit" });
    await addPending(e1);
    await addPending(e2);

    await resolvePending(e1.id, { approved: true, resolved_at: new Date().toISOString() });

    const remaining = await listPending();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.id).toBe(e2.id);
  });
});

describe("cleanStalePending", () => {
  it("removes entries older than the threshold", async () => {
    const oldTime = new Date(Date.now() - 7_200_000).toISOString(); // 2 hours ago
    const old = makePending({ requested_at: oldTime });
    await addPending(old);

    const removed = await cleanStalePending(3_600_000); // 1 hour threshold
    expect(removed).toBe(1);

    const remaining = await listPending();
    expect(remaining).toHaveLength(0);
  });

  it("keeps entries newer than the threshold", async () => {
    const recent = makePending({ requested_at: new Date().toISOString() });
    await addPending(recent);

    const removed = await cleanStalePending(3_600_000);
    expect(removed).toBe(0);

    const remaining = await listPending();
    expect(remaining).toHaveLength(1);
  });

  it("removes only stale entries, keeps fresh ones", async () => {
    const oldTime = new Date(Date.now() - 7_200_000).toISOString();
    const old1 = makePending({ requested_at: oldTime });
    const old2 = makePending({ requested_at: oldTime });
    const fresh = makePending({ requested_at: new Date().toISOString() });

    await addPending(old1);
    await addPending(old2);
    await addPending(fresh);

    const removed = await cleanStalePending(3_600_000);
    expect(removed).toBe(2);

    const remaining = await listPending();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.id).toBe(fresh.id);
  });

  it("defaults to 1 hour threshold", async () => {
    const twoHoursAgo = new Date(Date.now() - 7_200_000).toISOString();
    const thirtyMinAgo = new Date(Date.now() - 1_800_000).toISOString();

    await addPending(makePending({ requested_at: twoHoursAgo }));
    await addPending(makePending({ requested_at: thirtyMinAgo }));

    const removed = await cleanStalePending(); // default 3600000
    expect(removed).toBe(1);
  });
});

describe("writeResolution / readResolution / clearResolution", () => {
  it("writeResolution and readResolution round-trip correctly", async () => {
    const id = randomUUID();
    const resolution: ResolvedApproval = {
      approved: true,
      resolved_at: new Date().toISOString(),
    };

    await writeResolution(id, resolution);
    const result = await readResolution(id);
    expect(result?.approved).toBe(true);
    expect(result?.resolved_at).toBe(resolution.resolved_at);
  });

  it("readResolution returns null when id not found", async () => {
    const result = await readResolution("nonexistent-id");
    expect(result).toBeNull();
  });

  it("readResolution returns null when resolutions file does not exist", async () => {
    const result = await readResolution("any-id");
    expect(result).toBeNull();
  });

  it("writeResolution with approved: false preserves reason", async () => {
    const id = randomUUID();
    await writeResolution(id, {
      approved: false,
      reason: "Security concern",
      resolved_at: new Date().toISOString(),
    });
    const result = await readResolution(id);
    expect(result?.approved).toBe(false);
    expect(result?.reason).toBe("Security concern");
  });

  it("clearResolution removes the entry", async () => {
    const id = randomUUID();
    await writeResolution(id, { approved: true, resolved_at: new Date().toISOString() });
    await clearResolution(id);
    const result = await readResolution(id);
    expect(result).toBeNull();
  });

  it("clearResolution is idempotent for missing id", async () => {
    await expect(clearResolution("nonexistent-id")).resolves.not.toThrow();
  });

  it("multiple resolutions can coexist", async () => {
    const id1 = randomUUID();
    const id2 = randomUUID();
    await writeResolution(id1, { approved: true, resolved_at: new Date().toISOString() });
    await writeResolution(id2, { approved: false, resolved_at: new Date().toISOString() });

    const r1 = await readResolution(id1);
    const r2 = await readResolution(id2);
    expect(r1?.approved).toBe(true);
    expect(r2?.approved).toBe(false);
  });
});
