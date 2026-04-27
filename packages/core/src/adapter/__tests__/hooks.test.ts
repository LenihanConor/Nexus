import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateHookConfig, installHooks, removeHooks, parseHookStdin } from "../hooks.js";

let tempDir: string;

beforeEach(() => {
  tempDir = join(tmpdir(), `nexus-hooks-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("generateHookConfig", () => {
  it("generates config with session ID in commands", () => {
    const config = generateHookConfig("ses-123");
    expect(config.hooks).toBeTruthy();
    expect(config.hooks!.PreToolUse).toHaveLength(1);
    expect(config.hooks!.PostToolUse).toHaveLength(2);
    expect(config.hooks!.Stop).toHaveLength(1);

    const preToolCmd = config.hooks!.PreToolUse![0]!.hooks[0]!.command;
    expect(preToolCmd).toContain("ses-123");
    expect(preToolCmd).toContain("adapter hook");
    expect(preToolCmd).toContain("PreToolUse");
  });

  it("sets 5 second timeout on all hooks", () => {
    const config = generateHookConfig("ses-123");
    for (const groups of Object.values(config.hooks!)) {
      for (const group of groups!) {
        for (const hook of group.hooks) {
          expect(hook.timeout).toBe(5);
        }
      }
    }
  });

  it("matches Write|Edit|MultiEdit for PreToolUse", () => {
    const config = generateHookConfig("ses-123");
    expect(config.hooks!.PreToolUse![0]!.matcher).toBe("Write|Edit|MultiEdit");
  });

  it("matches Bash and Read|Glob|Grep for PostToolUse", () => {
    const config = generateHookConfig("ses-123");
    expect(config.hooks!.PostToolUse![0]!.matcher).toBe("Bash");
    expect(config.hooks!.PostToolUse![1]!.matcher).toBe("Read|Glob|Grep");
  });
});

describe("installHooks", () => {
  it("creates settings.local.json with hooks", async () => {
    await installHooks(tempDir, "ses-456");

    const configPath = join(tempDir, ".claude", "settings.local.json");
    const content = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(content.hooks).toBeTruthy();
    expect(content.hooks.PreToolUse).toHaveLength(1);
  });

  it("merges with existing settings.local.json", async () => {
    const configDir = join(tempDir, ".claude");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "settings.local.json"),
      JSON.stringify({
        someOtherSetting: true,
        hooks: {
          PreToolUse: [
            { matcher: "Bash", hooks: [{ type: "command", command: "echo existing", timeout: 10 }] },
          ],
        },
      }),
    );

    await installHooks(tempDir, "ses-789");

    const content = JSON.parse(readFileSync(join(configDir, "settings.local.json"), "utf-8"));
    expect(content.someOtherSetting).toBe(true);
    expect(content.hooks.PreToolUse).toHaveLength(2); // existing + nexus
  });
});

describe("removeHooks", () => {
  it("removes only nexus hooks", async () => {
    const configDir = join(tempDir, ".claude");
    mkdirSync(configDir, { recursive: true });

    // Install nexus hooks first
    await installHooks(tempDir, "ses-remove-test");

    // Add a non-nexus hook
    const configPath = join(configDir, "settings.local.json");
    const content = JSON.parse(readFileSync(configPath, "utf-8"));
    content.hooks.PreToolUse.push({
      matcher: "Bash",
      hooks: [{ type: "command", command: "echo user-hook", timeout: 10 }],
    });
    writeFileSync(configPath, JSON.stringify(content));

    await removeHooks(tempDir);

    const after = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(after.hooks.PreToolUse).toHaveLength(1); // Only user hook remains
    expect(after.hooks.PreToolUse[0].hooks[0].command).toBe("echo user-hook");
    // Nexus-only events should be fully removed
    expect(after.hooks.Stop).toBeUndefined();
  });

  it("handles missing config file gracefully", async () => {
    await expect(removeHooks(tempDir)).resolves.toBeUndefined();
  });

  it("removes hooks key when empty", async () => {
    await installHooks(tempDir, "ses-clean");
    await removeHooks(tempDir);

    const configPath = join(tempDir, ".claude", "settings.local.json");
    const content = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(content.hooks).toBeUndefined();
  });
});

describe("parseHookStdin", () => {
  it("parses PreToolUse Write with file path", () => {
    const result = parseHookStdin("PreToolUse", {
      tool_name: "Write",
      tool_input: { file_path: "src/auth.ts", content: "..." },
    });
    expect(result.label).toBe("pre_tool_write");
    expect(result.filesChanged).toEqual(["src/auth.ts"]);
  });

  it("parses PreToolUse Edit with file path", () => {
    const result = parseHookStdin("PreToolUse", {
      tool_name: "Edit",
      tool_input: { file_path: "src/config.ts", old_string: "a", new_string: "b" },
    });
    expect(result.filesChanged).toEqual(["src/config.ts"]);
  });

  it("parses PostToolUse Bash with command", () => {
    const result = parseHookStdin("PostToolUse", {
      tool_name: "Bash",
      tool_input: { command: "npm test", description: "Run tests" },
    });
    expect(result.label).toBe("Run tests");
    expect(result.notes).toBe("npm test");
  });

  it("parses PostToolUse Bash with long command truncation", () => {
    const longCmd = "x".repeat(300);
    const result = parseHookStdin("PostToolUse", {
      tool_name: "Bash",
      tool_input: { command: longCmd },
    });
    expect(result.notes!.length).toBe(200);
  });

  it("parses PostToolUse Read as activity tracking", () => {
    const result = parseHookStdin("PostToolUse", {
      tool_name: "Read",
      tool_input: { file_path: "src/main.ts" },
    });
    expect(result.label).toBe("post_tool_read");
    expect(result.notes).toBe("Read tool used");
  });

  it("parses Stop event", () => {
    const result = parseHookStdin("Stop", {
      stop_reason: "completed",
    });
    expect(result.label).toBe("agent_stopped");
    expect(result.notes).toBe("completed");
  });

  it("handles empty input gracefully", () => {
    const result = parseHookStdin("PreToolUse", {});
    expect(result.label).toBe("pre_tool_unknown");
    expect(result.filesChanged).toBeUndefined();
  });

  it("handles unknown event type", () => {
    const result = parseHookStdin("UnknownEvent", {});
    expect(result.label).toBe("hook_unknownevent");
  });
});

describe("runner helpers", () => {
  it("mapExitToStatus maps exit codes correctly", async () => {
    const { mapExitToStatus } = await import("../runner.js");
    expect(mapExitToStatus({ exitCode: 0, signal: null, durationMs: 100 })).toBe("completed");
    expect(mapExitToStatus({ exitCode: 1, signal: null, durationMs: 100 })).toBe("failed");
    expect(mapExitToStatus({ exitCode: 130, signal: null, durationMs: 100 })).toBe("interrupted");
    expect(mapExitToStatus({ exitCode: 0, signal: "SIGINT", durationMs: 100 })).toBe("interrupted");
    expect(mapExitToStatus({ exitCode: 0, signal: "SIGTERM", durationMs: 100 })).toBe("interrupted");
  });
});
