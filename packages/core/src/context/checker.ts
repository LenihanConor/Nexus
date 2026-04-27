import type { ContextHealthConfig, ContextHealthResult } from "@nexus/shared";

export function checkContextHealth(
  contextWindowPercent: number,
  config: ContextHealthConfig,
): ContextHealthResult {
  if (contextWindowPercent >= config.critical_at_percent) {
    return {
      level: "critical",
      context_window_percent: contextWindowPercent,
      threshold_crossed: config.critical_at_percent,
    };
  }

  if (contextWindowPercent >= config.warn_at_percent) {
    return {
      level: "warn",
      context_window_percent: contextWindowPercent,
      threshold_crossed: config.warn_at_percent,
    };
  }

  return {
    level: "ok",
    context_window_percent: contextWindowPercent,
    threshold_crossed: null,
  };
}
