import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

interface HookEntry {
  type: string;
  command: string;
  timeout: number;
}

interface HookGroup {
  matcher?: string;
  hooks: HookEntry[];
}

interface HooksConfig {
  hooks?: Record<string, HookGroup[]>;
  [key: string]: unknown;
}

const NEXUS_HOOK_MARKER = "adapter hook --session";

function resolveNexusBin(): string {
  return process.argv[1] ?? "nexus";
}

export function generateHookConfig(sessionId: string): HooksConfig {
  const bin = resolveNexusBin();
  const cmd = (event: string) => `"${bin}" adapter hook --session ${sessionId} --event ${event}`;

  return {
    hooks: {
      PreToolUse: [
        {
          matcher: "Write|Edit|MultiEdit",
          hooks: [{ type: "command", command: cmd("PreToolUse"), timeout: 5 }],
        },
      ],
      PostToolUse: [
        {
          matcher: "Bash",
          hooks: [{ type: "command", command: cmd("PostToolUse"), timeout: 5 }],
        },
        {
          matcher: "Read|Glob|Grep",
          hooks: [{ type: "command", command: cmd("PostToolUse"), timeout: 5 }],
        },
      ],
      Stop: [
        {
          hooks: [{ type: "command", command: cmd("Stop"), timeout: 5 }],
        },
      ],
    },
  };
}

export async function installHooks(worktreePath: string, sessionId: string): Promise<void> {
  const configPath = join(worktreePath, ".claude", "settings.local.json");
  const configDir = dirname(configPath);
  await mkdir(configDir, { recursive: true });

  let existing: HooksConfig = {};
  try {
    const raw = await readFile(configPath, "utf-8");
    existing = JSON.parse(raw) as HooksConfig;
  } catch {
    // File doesn't exist or is invalid — start fresh
  }

  const nexusConfig = generateHookConfig(sessionId);

  if (!existing.hooks) {
    existing.hooks = {};
  }

  for (const [event, groups] of Object.entries(nexusConfig.hooks!)) {
    if (!existing.hooks[event]) {
      existing.hooks[event] = [];
    }
    existing.hooks[event].push(...groups);
  }

  await writeFile(configPath, JSON.stringify(existing, null, 2) + "\n");
}

export async function removeHooks(worktreePath: string): Promise<void> {
  const configPath = join(worktreePath, ".claude", "settings.local.json");

  let config: HooksConfig;
  try {
    const raw = await readFile(configPath, "utf-8");
    config = JSON.parse(raw) as HooksConfig;
  } catch {
    return;
  }

  if (!config.hooks) return;

  for (const event of Object.keys(config.hooks)) {
    config.hooks[event] = config.hooks[event].filter((group) => {
      group.hooks = group.hooks.filter(
        (h) => !h.command.includes(NEXUS_HOOK_MARKER),
      );
      return group.hooks.length > 0;
    });
    if (config.hooks[event].length === 0) {
      delete config.hooks[event];
    }
  }

  if (Object.keys(config.hooks).length === 0) {
    delete config.hooks;
  }

  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n");
}

export interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: Record<string, unknown>;
  duration_ms?: number;
  stop_reason?: string;
  [key: string]: unknown;
}

export interface ParsedHookData {
  label: string;
  filesChanged?: string[];
  notes?: string;
}

export function parseHookStdin(event: string, input: HookInput): ParsedHookData {
  const toolName = input.tool_name ?? "unknown";

  switch (event) {
    case "PreToolUse": {
      const filePath = input.tool_input?.file_path as string | undefined;
      return {
        label: `pre_tool_${toolName.toLowerCase()}`,
        filesChanged: filePath ? [filePath] : undefined,
      };
    }
    case "PostToolUse": {
      if (toolName === "Bash") {
        const command = input.tool_input?.command as string | undefined;
        const description = input.tool_input?.description as string | undefined;
        return {
          label: description ?? `bash_command`,
          notes: command ? command.slice(0, 200) : undefined,
        };
      }
      return {
        label: `post_tool_${toolName.toLowerCase()}`,
        notes: `${toolName} tool used`,
      };
    }
    case "Stop": {
      return {
        label: "agent_stopped",
        notes: input.stop_reason ?? undefined,
      };
    }
    default:
      return { label: `hook_${event.toLowerCase()}` };
  }
}
