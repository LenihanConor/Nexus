import { randomUUID } from "node:crypto";
import type { ApprovalTier, ApprovalConfig, ApprovalDecision, PendingApproval } from "@nexus/shared";
import { emitEvent } from "../audit/emitter.js";
import {
  addPending,
  resolvePending,
  readResolution,
  writeResolution,
  clearResolution,
} from "./store.js";

const POLL_INTERVAL_MS = 500;

function now(): string {
  return new Date().toISOString();
}

async function pollForResolution(
  id: string,
  timeoutMs: number | null,
): Promise<{ resolved: true; approved: boolean; reason?: string } | { resolved: false }> {
  const start = Date.now();

  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      const resolution = await readResolution(id);
      if (resolution !== null) {
        clearInterval(interval);
        resolve({ resolved: true, approved: resolution.approved, reason: resolution.reason });
        return;
      }

      if (timeoutMs !== null && Date.now() - start >= timeoutMs) {
        clearInterval(interval);
        resolve({ resolved: false });
      }
    }, POLL_INTERVAL_MS);
  });
}

export async function requestApproval(
  sessionId: string,
  project: string,
  tool: string,
  args: Record<string, unknown>,
  tier: ApprovalTier,
  config: ApprovalConfig,
): Promise<ApprovalDecision> {
  if (tier === "routine") {
    await emitEvent(
      "approval.auto_approved",
      sessionId,
      { session_id: sessionId, tool, tier },
      { project },
    );
    return { approved: true, method: "auto", decided_at: now() };
  }

  const id = randomUUID();
  const timeoutSeconds = config.global.timeout_seconds;
  const timeoutAt =
    tier === "constrained"
      ? new Date(Date.now() + timeoutSeconds * 1000).toISOString()
      : null;

  const entry: PendingApproval = {
    id,
    session_id: sessionId,
    project,
    tool,
    args,
    tier,
    requested_at: now(),
    timeout_at: timeoutAt,
  };

  await addPending(entry);

  await emitEvent(
    "approval.requested",
    sessionId,
    { session_id: sessionId, approval_id: id, tool, tier, timeout_at: timeoutAt },
    { project },
  );

  if (tier === "constrained") {
    process.stderr.write(
      `[nexus] Approval needed (constrained): ${tool} — responding in ${timeoutSeconds}s... (nexus approve ${id})\n`,
    );

    const result = await pollForResolution(id, timeoutSeconds * 1000);

    if (result.resolved) {
      await resolvePending(id, { approved: result.approved, reason: result.reason, resolved_at: now() });
      await clearResolution(id);

      if (result.approved) {
        await emitEvent(
          "approval.human_approved",
          sessionId,
          { session_id: sessionId, approval_id: id, tool },
          { project },
        );
        return { approved: true, method: "human", decided_at: now() };
      } else {
        await emitEvent(
          "approval.rejected",
          sessionId,
          { session_id: sessionId, approval_id: id, tool, reason: result.reason ?? null },
          { project },
        );
        return { approved: false, method: "human", decided_at: now(), reason: result.reason };
      }
    } else {
      // Timeout — auto-approve
      await resolvePending(id, { approved: true, resolved_at: now() });
      await emitEvent(
        "approval.timeout_approved",
        sessionId,
        { session_id: sessionId, approval_id: id, tool },
        { project },
      );
      return { approved: true, method: "timeout", decided_at: now() };
    }
  }

  // standard or critical — wait indefinitely
  if (tier === "standard") {
    process.stderr.write(
      `[nexus] Approval needed (standard): ${tool} — waiting for: nexus approve ${id}\n`,
    );
  } else {
    process.stderr.write(
      `[nexus] CRITICAL approval required: ${tool} — waiting for: nexus approve ${id} (no timeout)\n`,
    );
  }

  const result = await pollForResolution(id, null);

  if (!result.resolved) {
    // Should never happen since timeoutMs is null, but guard defensively
    await resolvePending(id, { approved: false, resolved_at: now() });
    return { approved: false, method: "human", decided_at: now() };
  }

  await resolvePending(id, { approved: result.approved, reason: result.reason, resolved_at: now() });
  await clearResolution(id);

  if (result.approved) {
    await emitEvent(
      "approval.human_approved",
      sessionId,
      { session_id: sessionId, approval_id: id, tool },
      { project },
    );
    return { approved: true, method: "human", decided_at: now() };
  } else {
    await emitEvent(
      "approval.rejected",
      sessionId,
      { session_id: sessionId, approval_id: id, tool, reason: result.reason ?? null },
      { project },
    );
    return { approved: false, method: "human", decided_at: now(), reason: result.reason };
  }
}
