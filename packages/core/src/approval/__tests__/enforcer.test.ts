import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setNexusDir } from "../../audit/emitter.js";
import { resetStoreDirCache, listPending, writeResolution } from "../store.js";
import { DEFAULT_APPROVAL_CONFIG } from "../config.js";
import { requestApproval } from "../enforcer.js";
import type { ApprovalConfig } from "@nexus/shared";

let tempDir: string;

beforeEach(() => {
  tempDir = join(
    tmpdir(),
    `nexus-approval-enforcer-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(tempDir, { recursive: true });
  setNexusDir(tempDir);
  resetStoreDirCache();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  rmSync(tempDir, { recursive: true, force: true });
});

const SESSION = "sess-enforcer-1";
const PROJECT = "C:/GitHub/Test";

/** Minimal config with very short timeout for fast real-timer tests */
function fastConfig(timeoutSeconds = 1): ApprovalConfig {
  return {
    ...DEFAULT_APPROVAL_CONFIG,
    global: { ...DEFAULT_APPROVAL_CONFIG.global, timeout_seconds: timeoutSeconds },
  };
}

/** Wait for real I/O to settle */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("requestApproval — routine tier", () => {
  it("auto-approves immediately without adding to pending store", async () => {
    const decision = await requestApproval(
      SESSION, PROJECT, "Read", {}, "routine", DEFAULT_APPROVAL_CONFIG,
    );

    expect(decision.approved).toBe(true);
    expect(decision.method).toBe("auto");
    expect(decision.decided_at).toBeTruthy();

    const pending = await listPending();
    expect(pending).toHaveLength(0);
  });

  it("does not print to stderr for routine tier", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await requestApproval(SESSION, PROJECT, "Read", {}, "routine", DEFAULT_APPROVAL_CONFIG);

    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("auto-approve returns decided_at ISO timestamp", async () => {
    const before = new Date().toISOString();
    const decision = await requestApproval(
      SESSION, PROJECT, "Glob", {}, "routine", DEFAULT_APPROVAL_CONFIG,
    );
    const after = new Date().toISOString();
    expect(decision.decided_at >= before).toBe(true);
    expect(decision.decided_at <= after).toBe(true);
  });
});

describe("requestApproval — constrained tier (real timers)", () => {
  it("auto-approves on timeout when no human response", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const config = fastConfig(1); // 1 second timeout

    const decision = await requestApproval(
      SESSION, PROJECT, "Write", { file_path: "/test.ts" }, "constrained", config,
    );

    expect(decision.approved).toBe(true);
    expect(decision.method).toBe("timeout");
    stderrSpy.mockRestore();
  }, 5000);

  it("prints constrained warning message to stderr", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const config = fastConfig(1);

    await requestApproval(SESSION, PROJECT, "Write", {}, "constrained", config);

    const written = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("[nexus] Approval needed (constrained): Write");
    expect(written).toContain("nexus approve");
    stderrSpy.mockRestore();
  }, 5000);

  it("adds entry to pending store with correct timeout_at", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const config = fastConfig(2);

    // Start approval, then immediately check pending before timeout
    const approvalPromise = requestApproval(
      SESSION, PROJECT, "Write", {}, "constrained", config,
    );

    // Give enough time for addPending to complete
    await wait(100);
    const pending = await listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]!.timeout_at).not.toBeNull();

    // Wait for approval to complete
    await approvalPromise;
    stderrSpy.mockRestore();
  }, 8000);

  it("approves immediately when human resolves before timeout", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const config = fastConfig(30); // long timeout so human acts first

    const approvalPromise = requestApproval(
      SESSION, PROJECT, "Write", {}, "constrained", config,
    );

    // Wait for addPending to complete
    await wait(150);
    const pending = await listPending();
    expect(pending).toHaveLength(1);
    const id = pending[0]!.id;

    // Simulate human approval
    await writeResolution(id, { approved: true, resolved_at: new Date().toISOString() });

    const decision = await approvalPromise;
    expect(decision.approved).toBe(true);
    expect(decision.method).toBe("human");
    stderrSpy.mockRestore();
  }, 5000);

  it("rejects immediately when human rejects before timeout", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const config = fastConfig(30);

    const approvalPromise = requestApproval(
      SESSION, PROJECT, "Write", {}, "constrained", config,
    );

    await wait(150);
    const pending = await listPending();
    const id = pending[0]!.id;
    await writeResolution(id, {
      approved: false,
      reason: "Too risky",
      resolved_at: new Date().toISOString(),
    });

    const decision = await approvalPromise;
    expect(decision.approved).toBe(false);
    expect(decision.method).toBe("human");
    expect(decision.reason).toBe("Too risky");
    stderrSpy.mockRestore();
  }, 5000);
});

describe("requestApproval — standard tier (fake timers)", () => {
  it("blocks until human approves", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const approvalPromise = requestApproval(
      SESSION, PROJECT, "Edit", {}, "standard", DEFAULT_APPROVAL_CONFIG,
    );

    // Allow real async file I/O to settle (shouldAdvanceTime: true lets real time pass)
    await vi.waitFor(async () => {
      const p = await listPending();
      expect(p.length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    const pending = await listPending();
    const id = pending[0]!.id;
    await writeResolution(id, { approved: true, resolved_at: new Date().toISOString() });

    // Advance timers past poll interval
    await vi.advanceTimersByTimeAsync(600);

    const decision = await approvalPromise;
    expect(decision.approved).toBe(true);
    expect(decision.method).toBe("human");

    stderrSpy.mockRestore();
    vi.useRealTimers();
  }, 10000);

  it("blocks until human rejects", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const approvalPromise = requestApproval(
      SESSION, PROJECT, "Edit", {}, "standard", DEFAULT_APPROVAL_CONFIG,
    );

    await vi.waitFor(async () => {
      const p = await listPending();
      expect(p.length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    const pending = await listPending();
    const id = pending[0]!.id;
    await writeResolution(id, {
      approved: false,
      reason: "Not allowed",
      resolved_at: new Date().toISOString(),
    });

    await vi.advanceTimersByTimeAsync(600);

    const decision = await approvalPromise;
    expect(decision.approved).toBe(false);
    expect(decision.method).toBe("human");

    stderrSpy.mockRestore();
    vi.useRealTimers();
  }, 10000);

  it("prints standard blocking message to stderr", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const approvalPromise = requestApproval(
      SESSION, PROJECT, "Edit", {}, "standard", DEFAULT_APPROVAL_CONFIG,
    );

    await vi.waitFor(async () => {
      const p = await listPending();
      expect(p.length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    const written = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("[nexus] Approval needed (standard): Edit");
    expect(written).toContain("nexus approve");

    const pending = await listPending();
    await writeResolution(pending[0]!.id, { approved: true, resolved_at: new Date().toISOString() });
    await vi.advanceTimersByTimeAsync(600);
    await approvalPromise;

    stderrSpy.mockRestore();
    vi.useRealTimers();
  }, 10000);

  it("adds entry to pending store with null timeout_at", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const approvalPromise = requestApproval(
      SESSION, PROJECT, "Edit", {}, "standard", DEFAULT_APPROVAL_CONFIG,
    );

    await vi.waitFor(async () => {
      const p = await listPending();
      expect(p.length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    const pending = await listPending();
    expect(pending[0]!.timeout_at).toBeNull();

    const id = pending[0]!.id;
    await writeResolution(id, { approved: true, resolved_at: new Date().toISOString() });
    await vi.advanceTimersByTimeAsync(600);
    await approvalPromise;

    stderrSpy.mockRestore();
    vi.useRealTimers();
  }, 10000);
});

describe("requestApproval — critical tier (fake timers)", () => {
  it("blocks until human approves (no timeout)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const approvalPromise = requestApproval(
      SESSION, PROJECT, "Bash", { command: "git push origin main" }, "critical", DEFAULT_APPROVAL_CONFIG,
    );

    await vi.waitFor(async () => {
      const p = await listPending();
      expect(p.length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    const pending = await listPending();
    expect(pending[0]!.tier).toBe("critical");
    expect(pending[0]!.timeout_at).toBeNull();

    const id = pending[0]!.id;
    await writeResolution(id, { approved: true, resolved_at: new Date().toISOString() });
    await vi.advanceTimersByTimeAsync(600);

    const decision = await approvalPromise;
    expect(decision.approved).toBe(true);
    expect(decision.method).toBe("human");

    stderrSpy.mockRestore();
    vi.useRealTimers();
  }, 10000);

  it("prints critical block message to stderr", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const approvalPromise = requestApproval(
      SESSION, PROJECT, "Bash", { command: "rm -rf /" }, "critical", DEFAULT_APPROVAL_CONFIG,
    );

    await vi.waitFor(async () => {
      const p = await listPending();
      expect(p.length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    const written = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("[nexus] CRITICAL approval required");
    expect(written).toContain("no timeout");

    const pending = await listPending();
    await writeResolution(pending[0]!.id, { approved: true, resolved_at: new Date().toISOString() });
    await vi.advanceTimersByTimeAsync(600);
    await approvalPromise;

    stderrSpy.mockRestore();
    vi.useRealTimers();
  }, 10000);

  it("critical rejected returns approved: false", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    const approvalPromise = requestApproval(
      SESSION, PROJECT, "Bash", { command: "git reset --hard" }, "critical", DEFAULT_APPROVAL_CONFIG,
    );

    await vi.waitFor(async () => {
      const p = await listPending();
      expect(p.length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    const pending = await listPending();
    await writeResolution(pending[0]!.id, {
      approved: false,
      reason: "Dangerous",
      resolved_at: new Date().toISOString(),
    });
    await vi.advanceTimersByTimeAsync(600);

    const decision = await approvalPromise;
    expect(decision.approved).toBe(false);
    expect(decision.method).toBe("human");

    stderrSpy.mockRestore();
    vi.useRealTimers();
  }, 10000);
});
