import { emitEvent } from "../audit/emitter.js";
import { loadContextConfig } from "./config.js";
import { checkContextHealth } from "./checker.js";
import { getOrCreateAlertState } from "./types.js";

export async function checkAndAlert(
  sessionId: string,
  project: string,
  contextWindowPercent: number | undefined,
): Promise<void> {
  if (contextWindowPercent === undefined || contextWindowPercent === 0) {
    return;
  }

  const config = await loadContextConfig();
  const result = checkContextHealth(contextWindowPercent, config);
  const state = getOrCreateAlertState(sessionId);

  if (result.level === "warn" && !state.warnEmitted) {
    state.warnEmitted = true;
    await emitEvent(
      "context.warn",
      sessionId,
      {
        session_id: sessionId,
        context_window_percent: contextWindowPercent,
        threshold: result.threshold_crossed!,
      },
      { project },
    );
    process.stderr.write(
      `[nexus] Warning: Session ${sessionId.slice(0, 8)} context window at ${contextWindowPercent}% (warn threshold: ${result.threshold_crossed!}%)\n`,
    );
  }

  if (result.level === "critical" && !state.criticalEmitted) {
    state.criticalEmitted = true;
    await emitEvent(
      "context.critical",
      sessionId,
      {
        session_id: sessionId,
        context_window_percent: contextWindowPercent,
        threshold: result.threshold_crossed!,
      },
      { project },
    );
    process.stderr.write(
      `[nexus] Critical: Session ${sessionId.slice(0, 8)} context window at ${contextWindowPercent}% — consider compacting or restarting\n`,
    );
  }
}
