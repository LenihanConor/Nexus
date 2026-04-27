import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setNexusDir } from "../../audit/emitter.js";
import {
  DEFAULT_APPROVAL_CONFIG,
  loadApprovalConfig,
  saveApprovalConfig,
  getApprovalConfigPath,
} from "../config.js";
import type { ApprovalConfig } from "@nexus/shared";

let tempDir: string;

beforeEach(() => {
  tempDir = join(
    tmpdir(),
    `nexus-approval-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(tempDir, { recursive: true });
  setNexusDir(tempDir);
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("DEFAULT_APPROVAL_CONFIG", () => {
  it("has default_tier of standard", () => {
    expect(DEFAULT_APPROVAL_CONFIG.global.default_tier).toBe("standard");
  });

  it("has timeout_seconds of 30", () => {
    expect(DEFAULT_APPROVAL_CONFIG.global.timeout_seconds).toBe(30);
  });

  it("includes Read as routine", () => {
    const rule = DEFAULT_APPROVAL_CONFIG.global.rules.find((r) => r.tool === "Read");
    expect(rule).toBeDefined();
    expect(rule!.tier).toBe("routine");
  });

  it("includes Glob as routine", () => {
    const rule = DEFAULT_APPROVAL_CONFIG.global.rules.find((r) => r.tool === "Glob");
    expect(rule?.tier).toBe("routine");
  });

  it("includes Grep as routine", () => {
    const rule = DEFAULT_APPROVAL_CONFIG.global.rules.find((r) => r.tool === "Grep");
    expect(rule?.tier).toBe("routine");
  });

  it("includes WebSearch as routine", () => {
    const rule = DEFAULT_APPROVAL_CONFIG.global.rules.find((r) => r.tool === "WebSearch");
    expect(rule?.tier).toBe("routine");
  });

  it("includes Write as constrained", () => {
    const rule = DEFAULT_APPROVAL_CONFIG.global.rules.find((r) => r.tool === "Write" && !r.args_match);
    expect(rule?.tier).toBe("constrained");
  });

  it("includes Edit as standard", () => {
    const rule = DEFAULT_APPROVAL_CONFIG.global.rules.find((r) => r.tool === "Edit" && !r.args_match);
    expect(rule?.tier).toBe("standard");
  });

  it("includes git push main as critical", () => {
    const rule = DEFAULT_APPROVAL_CONFIG.global.rules.find(
      (r) => r.tool === "Bash" && r.args_match === "git push.*main",
    );
    expect(rule?.tier).toBe("critical");
  });

  it("includes git reset --hard as critical", () => {
    const rule = DEFAULT_APPROVAL_CONFIG.global.rules.find(
      (r) => r.tool === "Bash" && r.args_match === "git reset --hard",
    );
    expect(rule?.tier).toBe("critical");
  });

  it("includes rm as critical", () => {
    const rule = DEFAULT_APPROVAL_CONFIG.global.rules.find(
      (r) => r.tool === "Bash" && r.args_match === "rm ",
    );
    expect(rule?.tier).toBe("critical");
  });

  it("has empty projects by default", () => {
    expect(DEFAULT_APPROVAL_CONFIG.projects).toEqual({});
  });
});

describe("loadApprovalConfig", () => {
  it("returns DEFAULT_APPROVAL_CONFIG when file does not exist", async () => {
    const config = await loadApprovalConfig();
    expect(config).toEqual(DEFAULT_APPROVAL_CONFIG);
  });

  it("loads config from file when it exists", async () => {
    const customConfig: ApprovalConfig = {
      global: {
        default_tier: "routine",
        timeout_seconds: 60,
        rules: [{ tool: "Read", tier: "critical" }],
      },
      projects: {},
    };
    await saveApprovalConfig(customConfig);

    const loaded = await loadApprovalConfig();
    expect(loaded.global.default_tier).toBe("routine");
    expect(loaded.global.timeout_seconds).toBe(60);
    expect(loaded.global.rules).toHaveLength(1);
    expect(loaded.global.rules[0]!.tier).toBe("critical");
  });

  it("returns DEFAULT_APPROVAL_CONFIG for invalid JSON", async () => {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(getApprovalConfigPath(), "not valid json", "utf-8");

    const config = await loadApprovalConfig();
    expect(config).toEqual(DEFAULT_APPROVAL_CONFIG);
  });
});

describe("saveApprovalConfig", () => {
  it("writes valid JSON file", async () => {
    const config = DEFAULT_APPROVAL_CONFIG;
    await saveApprovalConfig(config);

    const { readFileSync } = await import("node:fs");
    const raw = readFileSync(getApprovalConfigPath(), "utf-8");
    const parsed = JSON.parse(raw) as ApprovalConfig;
    expect(parsed.global.default_tier).toBe("standard");
  });

  it("creates parent directory if needed", async () => {
    // setNexusDir to a nested path that doesn't exist yet
    const nested = join(tempDir, "deeply", "nested");
    setNexusDir(nested);

    await saveApprovalConfig(DEFAULT_APPROVAL_CONFIG);

    const { existsSync } = await import("node:fs");
    expect(existsSync(getApprovalConfigPath())).toBe(true);

    // restore
    setNexusDir(tempDir);
  });

  it("round-trips config with project overrides", async () => {
    const config: ApprovalConfig = {
      ...DEFAULT_APPROVAL_CONFIG,
      projects: {
        "C:/GitHub/MyProject": {
          rules: [{ tool: "Edit", tier: "critical" }],
        },
      },
    };
    await saveApprovalConfig(config);
    const loaded = await loadApprovalConfig();
    expect(loaded.projects["C:/GitHub/MyProject"]?.rules?.[0]?.tier).toBe("critical");
  });
});
