export interface ContextHealthConfig {
  warn_at_percent: number;
  critical_at_percent: number;
}

export type ContextHealthLevel = "ok" | "warn" | "critical";

export interface ContextHealthResult {
  level: ContextHealthLevel;
  context_window_percent: number;
  threshold_crossed: number | null;
}
