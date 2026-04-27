import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { getNexusDir } from "../audit/emitter.js";
import { createSession, endSession, updateSession } from "../session/lifecycle.js";
import { parseHookStdin } from "./hooks.js";
import type { HookInput } from "./hooks.js";

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
}

export async function autoEnd(claudeSessionId: string): Promise<void> {
  const mapping = await readMapping(claudeSessionId);
  if (!mapping) return;

  await endSession(mapping.nexusSessionId, {
    status: "completed",
  });

  await removeMapping(claudeSessionId);
}
