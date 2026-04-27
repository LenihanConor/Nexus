import type { UsageRecord, BudgetPeriod, BudgetCap, SpendSummary, BudgetStatusLevel } from "@nexus/shared";

/**
 * Returns the ISO string for the start of the current period.
 * Uses local time for daily/weekly/monthly (users think in local time for cost monitoring).
 */
export function getPeriodStart(period: BudgetPeriod): string {
  if (period === "all-time") {
    return "2000-01-01T00:00:00.000Z";
  }

  const now = new Date();

  if (period === "daily") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    return d.toISOString();
  }

  if (period === "weekly") {
    // This Monday (day=1). If today is Sunday (0), go back 6 days.
    const day = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const daysBack = day === 0 ? 6 : day - 1;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBack, 0, 0, 0, 0);
    return monday.toISOString();
  }

  // monthly
  const d = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Sum up usage records for a project in the given period.
 * Records before resetTimestamp are excluded if provided.
 */
export function computeSpend(
  records: UsageRecord[],
  project: string,
  period: BudgetPeriod,
  resetTimestamp?: string,
): SpendSummary {
  const periodStart = getPeriodStart(period);
  const periodEnd = new Date().toISOString();

  const filtered = records.filter((r) => {
    if (r.project !== project) return false;
    if (r.timestamp < periodStart) return false;
    if (resetTimestamp && r.timestamp < resetTimestamp) return false;
    return true;
  });

  const sessionIds = new Set<string>();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUsd = 0;

  for (const r of filtered) {
    totalInputTokens += r.input_tokens;
    totalOutputTokens += r.output_tokens;
    totalCostUsd += r.estimated_cost_usd;
    sessionIds.add(r.session_id);
  }

  return {
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    total_cost_usd: totalCostUsd,
    session_count: sessionIds.size,
    period_start: periodStart,
    period_end: periodEnd,
  };
}

/**
 * Evaluate spend against a cap config and return a status level.
 * Null caps always return "ok".
 */
export function evaluateBudget(spent_usd: number, cap: BudgetCap): BudgetStatusLevel {
  if (cap.hard_cap_usd !== null && spent_usd >= cap.hard_cap_usd) {
    return "hard_cap_exceeded";
  }
  if (cap.soft_cap_usd !== null && spent_usd >= cap.soft_cap_usd) {
    return "soft_cap_reached";
  }
  return "ok";
}
