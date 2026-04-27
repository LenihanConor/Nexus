import { Command } from "commander";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";

const NEXUS_MARKER = "nexus adapter hook";

function nexusBin(): string {
  return resolve(join(import.meta.dirname, "index.js"));
}

interface HookEntry {
  type: string;
  command: string;
  timeout: number;
}

interface HookGroup {
  matcher?: string;
  hooks: HookEntry[];
}

interface SettingsFile {
  hooks?: Record<string, HookGroup[]>;
  [key: string]: unknown;
}

function buildHooks(project: string): Record<string, HookGroup[]> {
  const bin = nexusBin();
  const cmd = (event: string) => `node "${bin}" adapter hook --event ${event} --project "${project}"`;

  return {
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
    ],
    Stop: [
      {
        hooks: [{ type: "command", command: cmd("Stop"), timeout: 5 }],
      },
    ],
  };
}

export const initCommand = new Command("init")
  .description("Set up Nexus hooks for a project so every Claude Code session is tracked automatically")
  .argument("[project]", "Project directory (defaults to current directory)", ".")
  .action(async (projectArg: string) => {
    const project = resolve(projectArg);
    const configDir = join(project, ".claude");
    const configPath = join(configDir, "settings.local.json");

    await mkdir(configDir, { recursive: true });

    let existing: SettingsFile = {};
    try {
      const raw = await readFile(configPath, "utf-8");
      existing = JSON.parse(raw) as SettingsFile;
    } catch {
      // Doesn't exist yet
    }

    // Check if already installed
    if (existing.hooks) {
      for (const groups of Object.values(existing.hooks)) {
        for (const group of groups) {
          for (const hook of group.hooks) {
            if (hook.command.includes(NEXUS_MARKER)) {
              process.stdout.write(`Nexus hooks already installed in ${configPath}\n`);
              return;
            }
          }
        }
      }
    }

    if (!existing.hooks) {
      existing.hooks = {};
    }

    const nexusHooks = buildHooks(project);
    for (const [event, groups] of Object.entries(nexusHooks)) {
      if (!existing.hooks[event]) {
        existing.hooks[event] = [];
      }
      existing.hooks[event].push(...groups);
    }

    await writeFile(configPath, JSON.stringify(existing, null, 2) + "\n");

    process.stdout.write(`Nexus hooks installed in ${configPath}\n`);
    process.stdout.write(`\nEvery Claude Code session in ${project} will now be tracked.\n`);
    process.stdout.write(`Sessions, events, and activity appear in the dashboard automatically.\n`);
    process.stdout.write(`\nTo remove: delete the Nexus entries from ${configPath}\n`);
  });
