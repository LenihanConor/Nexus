import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { getNexusDir } from "../audit/emitter.js";
import { createSession, endSession, updateSession } from "../session/lifecycle.js";
import { parseHookStdin } from "./hooks.js";
import type { HookInput } from "./hooks.js";
import { checkAndAlert, resetAlertState } from "../context/index.js";
import { recordUsage } from "../budget/lifecycle.js";

function activeDir(): string {
  return join(getNexusDir(), "active");
}

function activePath(claudeSessionId: string): string {
  return join(activeDir(), `${claudeSessionId}.json`);
}

interface ActiveMapping {
  nexusSessionId: string;
  project: string;
}

async function readMapping(claudeSessionId: string): Promise<ActiveMapping | null> {
  try {
    const raw = await readFile(activePath(claudeSessionId), "utf-8");
    return JSON.parse(raw) as ActiveMapping;
  } catch {
    return null;
  }
}

async function writeMapping(claudeSessionId: string, mapping: ActiveMapping): Promise<void> {
  const dir = activeDir();
  await mkdir(dir, { recursive: true });
  await writeFile(activePath(claudeSessionId), JSON.stringify(mapping));
}

async function removeMapping(claudeSessionId: string): Promise<void> {
  try {
    await rm(activePath(claudeSessionId));
  } catch {
    // Already gone
  }
}

export async function autoStart(claudeSessionId: string, project: string, input: HookInput): Promise<void> {
  const existing = await readMapping(claudeSessionId);
  if (existing) return;

  const task = (input.tool_input?.task as string)
    ?? (input.tool_input?.message as string)
    ?? "Claude Code session";

  const session = await createSession({
    project,
    agent_type: "claude-code",
    task_description: task,
    metadata: { claude_session_id: claudeSessionId },
  });

  await writeMapping(claudeSessionId, {
    nexusSessionId: session.id,
    project,
  });
}

export async function autoCheckpoint(claudeSessionId: string, event: string, input: HookInput): Promise<void> {
  const mapping = await readMapping(claudeSessionId);
  if (!mapping) return;

  const parsed = parseHookStdin(event, input);

  await updateSession(mapping.nexusSessionId, {
    snapshot: {
      label: parsed.label,
      task_progress: null,
      decisions: [],
      files_changed: parsed.filesChanged ?? [],
      notes: parsed.notes ?? null,
    },
  });

  const contextWindowPercent =
    typeof (input as Record<string, unknown>).context_window_percent === "number"
      ? (input as Record<string, unknown>).context_window_percent as number
      : typeof ((input as Record<string, unknown>).context as Record<string, unknown> | undefined)?.window_percent === "number"
        ? ((input as Record<string, unknown>).context as Record<string, unknown>).window_percent as number
        : undefined;

  if (contextWindowPercent !== undefined && contextWindowPercent > 0) {
    await checkAndAlert(mapping.nexusSessionId, mapping.project, contextWindowPercent);
  }

  // Record token usage if present in hook input
  const raw = input as Record<string, unknown>;
  const usage = raw["usage"] as Record<string, unknown> | undefined;
  const inputTokens = typeof usage?.["input_tokens"] === "number" ? usage["input_tokens"] : 0;
  const outputTokens = typeof usage?.["output_tokens"] === "number" ? usage["output_tokens"] : 0;
  const cacheReadTokens = typeof usage?.["cache_read_input_tokens"] === "number" ? usage["cache_read_input_tokens"] : 0;
  const cacheCreationTokens = typeof usage?.["cache_creation_input_tokens"] === "number" ? usage["cache_creation_input_tokens"] : 0;
  const model = typeof raw["model"] === "string" ? raw["model"] : "claude-sonnet-4-6";

  if (inputTokens > 0 || outputTokens > 0 || cacheReadTokens > 0 || cacheCreationTokens > 0) {
    await recordUsage({
      session_id: mapping.nexusSessionId,
      project: mapping.project,
      agent_type: "claude-code",
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_read_tokens: cacheReadTokens,
      cache_creation_tokens: cacheCreationTokens,
    });
  }
}

export async function autoEnd(claudeSessionId: string): Promise<void> {
  const mapping = await readMapping(claudeSessionId);
  if (!mapping) return;

  await endSession(mapping.nexusSessionId, {
    status: "completed",
  });

  resetAlertState(mapping.nexusSessionId);
  await removeMapping(claudeSessionId);
}
