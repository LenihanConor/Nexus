export interface UsageRecord {
  id: string;
  session_id: string;
  project: string;
  agent_type: string;
  timestamp: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  model: string;
  estimated_cost_usd: number;
}

export type BudgetPeriod = "daily" | "weekly" | "monthly" | "all-time";

export interface BudgetCap {
  soft_cap_usd: number | null;
  hard_cap_usd: number | null;
  period: BudgetPeriod;
}

export interface BudgetConfig {
  global: BudgetCap;
  projects: Record<string, Partial<BudgetCap>>;
}

export interface SpendSummary {
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  session_count: number;
  period_start: string;
  period_end: string;
}

export type BudgetStatusLevel = "ok" | "soft_cap_reached" | "hard_cap_exceeded";

export interface BudgetStatus {
  status: BudgetStatusLevel;
  spent_usd: number;
  soft_cap_usd: number | null;
  hard_cap_usd: number | null;
  remaining_usd: number | null;
  period: BudgetPeriod;
}
