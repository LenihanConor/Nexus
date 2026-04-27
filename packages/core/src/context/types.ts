export interface ContextAlertState {
  warnEmitted: boolean;
  criticalEmitted: boolean;
}

// In-memory map: sessionId -> ContextAlertState
export const sessionAlertState = new Map<string, ContextAlertState>();

export function getOrCreateAlertState(sessionId: string): ContextAlertState {
  if (!sessionAlertState.has(sessionId)) {
    sessionAlertState.set(sessionId, { warnEmitted: false, criticalEmitted: false });
  }
  return sessionAlertState.get(sessionId)!;
}

export function resetAlertState(sessionId?: string): void {
  if (sessionId) sessionAlertState.delete(sessionId);
  else sessionAlertState.clear();
}
