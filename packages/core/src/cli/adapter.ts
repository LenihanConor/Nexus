import { Command } from "commander";
import { getSession } from "../session/index.js";
import { updateSession } from "../session/lifecycle.js";
import { parseHookStdin } from "../adapter/hooks.js";
import { autoStart, autoCheckpoint, autoEnd } from "../adapter/auto.js";
import type { HookInput } from "../adapter/hooks.js";

function readStdin(): Promise<HookInput> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk as Buffer));
    process.stdin.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8").trim();
      if (raw) {
        try {
          resolve(JSON.parse(raw) as HookInput);
          return;
        } catch { /* fall through */ }
      }
      resolve({});
    });
    process.stdin.on("error", () => resolve({}));
    setTimeout(() => resolve({}), 3000);
  });
}

export const adapterCommand = new Command("adapter")
  .description("Agent adapter internals (used by hooks)");

adapterCommand
  .command("hook")
  .description("Handle a Claude Code hook callback")
  .requiredOption("--event <name>", "Hook event name")
  .requiredOption("--project <path>", "Project path")
  .option("--session <id>", "Nexus session ID (for nexus run mode)")
  .action(async (opts: { event: string; project: string; session?: string }) => {
    try {
      const input = await readStdin();
      const claudeSessionId = input.session_id;

      if (opts.session) {
        const session = await getSession(opts.session);
        if (!session) { process.exit(0); return; }

        const parsed = parseHookStdin(opts.event, input);
        await updateSession(opts.session, {
          snapshot: {
            label: parsed.label,
            task_progress: null,
            decisions: [],
            files_changed: parsed.filesChanged ?? [],
            notes: parsed.notes ?? null,
          },
        });
      } else if (claudeSessionId) {
        if (opts.event === "Stop") {
          await autoCheckpoint(claudeSessionId, opts.event, input);
          await autoEnd(claudeSessionId);
        } else {
          await autoStart(claudeSessionId, opts.project, input);
          await autoCheckpoint(claudeSessionId, opts.event, input);
        }
      }
    } catch {
      // Hook handler must never fail loudly
    }

    process.exit(0);
  });
