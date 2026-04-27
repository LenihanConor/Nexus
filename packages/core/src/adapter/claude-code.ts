import { BaseAdapter } from "./base.js";
import { installHooks, removeHooks } from "./hooks.js";
import type { AdapterStartOpts, AdapterSession, AdapterResult } from "./types.js";

export class ClaudeCodeAdapter extends BaseAdapter {
  constructor() {
    super("claude-code");
  }

  override async start(opts: AdapterStartOpts): Promise<AdapterSession> {
    const session = await super.start(opts);

    if (session.worktreePath) {
      await installHooks(session.worktreePath, session.sessionId);
    }

    return session;
  }

  override async end(session: AdapterSession, result: AdapterResult): Promise<void> {
    if (session.worktreePath) {
      try {
        await removeHooks(session.worktreePath);
      } catch {
        // Cleanup failure is non-fatal — hooks reference a dead session ID
      }
    }

    await super.end(session, result);
  }
}
