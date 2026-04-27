import { randomUUID } from "node:crypto";
import type { UsageRecord, BudgetStatus, BudgetCap } from "@nexus/shared";
import { emitEvent } from "../audit/emitter.js";
import { appendUsageRecord, listUsageRecords } from "./store.js";
import { loadBudgetConfig } from "./config.js";
import { computeSpend, evaluateBudget } from "./checker.js";
import { estimateCost } from "./pricing.js";
import type { UsageInput } from "./types.js";

// In-memory set of sessions that have already received threshold warnings
// Keyed by `${sessionId}:soft` and `${sessionId}:hard`
const warnedSessions = new Set<string>();

/** Reset threshold dedup state — exported for tests */
export function resetBudgetAlertState(sessionId?: string): void {
  if (sessionId) {
    warnedSessions.delete(`${sessionId}:soft`);
    warnedSessions.delete(`${sessionId}:hard`);
  } else {
    warnedSessions.clear();
  }
}

function resolveProjectCap(config: Awaited<ReturnType<typeof loadBudgetConfig>>, project: string): BudgetCap {
  const projectOverride = config.projects[project];
  return {
    soft_cap_usd: projectOverride?.soft_cap_usd ?? config.global.soft_cap_usd,
    hard_cap_usd: projectOverride?.hard_cap_usd ?? config.global.hard_cap_usd,
    period: projectOverride?.period ?? config.global.period,
  };
}

/**
 * Record token usage for a session checkpoint.
 * Creates and persists a UsageRecord, checks budget, and emits events.
 */
export async function recordUsage(input: UsageInput): Promise<{ record: UsageRecord; status: BudgetStatus }> {
  const estimatedCost = estimateCost(
    input.model,
    input.input_tokens,
    input.output_tokens,
    input.cache_read_tokens,
    input.cache_creation_tokens,
  );

  const record: UsageRecord = {
    id: randomUUID(),
    session_id: input.session_id,
    project: input.project,
    agent_type: input.agent_type,
    timestamp: new Date().toISOString(),
    input_tokens: input.input_tokens,
    output_tokens: input.output_tokens,
    cache_read_tokens: input.cache_read_tokens,
    cache_creation_tokens: input.cache_creation_tokens,
    model: input.model,
    estimated_cost_usd: estimatedCost,
  };

  await appendUsageRecord(record);

  await emitEvent(
    "budget.usage_recorded",
    input.session_id,
    {
      session_id: input.session_id,
      project: input.project,
      model: input.model,
      input_tokens: input.input_tokens,
      output_tokens: input.output_tokens,
      cache_read_tokens: input.cache_read_tokens,
      cache_creation_tokens: input.cache_creation_tokens,
      estimated_cost_usd: estimatedCost,
    },
    { project: input.project },
  );

  const status = await checkBudget(input.project);

  const softKey = `${input.session_id}:soft`;
  const hardKey = `${input.session_id}:hard`;

  if (status.status === "hard_cap_exceeded" && !warnedSessions.has(hardKey)) {
    warnedSessions.add(hardKey);
    await emitEvent(
      "budget.cap_exceeded",
      input.session_id,
      {
        session_id: input.session_id,
        project: input.project,
        spent_usd: status.spent_usd,
        hard_cap_usd: status.hard_cap_usd,
      },
      { project: input.project },
    );
  } else if (status.status === "soft_cap_reached" && !warnedSessions.has(softKey)) {
    warnedSessions.add(softKey);
    await emitEvent(
      "budget.threshold_reached",
      input.session_id,
      {
        session_id: input.session_id,
        project: input.project,
        spent_usd: status.spent_usd,
        soft_cap_usd: status.soft_cap_usd,
      },
      { project: input.project },
    );
  }

  return { record, status };
}

/**
 * Check current budget status for a project.
 */
export async function checkBudget(project: string): Promise<BudgetStatus> {
  const config = await loadBudgetConfig();
  const cap = resolveProjectCap(config, project);
  const records = await listUsageRecords({ project });
  const summary = computeSpend(records, project, cap.period);
  const statusLevel = evaluateBudget(summary.total_cost_usd, cap);

  const remaining =
    cap.hard_cap_usd !== null
      ? Math.max(0, cap.hard_cap_usd - summary.total_cost_usd)
      : cap.soft_cap_usd !== null
        ? Math.max(0, cap.soft_cap_usd - summary.total_cost_usd)
        : null;

  return {
    status: statusLevel,
    spent_usd: summary.total_cost_usd,
    soft_cap_usd: cap.soft_cap_usd,
    hard_cap_usd: cap.hard_cap_usd,
    remaining_usd: remaining,
    period: cap.period,
  };
}

/**
 * Reset budget for a project (or globally).
 * Does NOT delete usage records — instead emits a budget.reset event to the audit trail.
 * Period queries will exclude records before the latest reset event for that project.
 */
export async function resetBudget(project?: string): Promise<void> {
  await emitEvent(
    "budget.reset",
    null,
    {
      project: project ?? null,
      reset_at: new Date().toISOString(),
    },
    { project: project ?? "" },
  );
}
