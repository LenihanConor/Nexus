import { describe, it, expect } from "vitest";
import { classifyToolCall } from "../rules.js";
import { DEFAULT_APPROVAL_CONFIG } from "../config.js";
import type { ApprovalConfig } from "@nexus/shared";

const PROJECT = "C:/GitHub/TestProject";

describe("classifyToolCall — routine tools", () => {
  it("classifies Read as routine", () => {
    expect(classifyToolCall("Read", {}, PROJECT, DEFAULT_APPROVAL_CONFIG)).toBe("routine");
  });

  it("classifies Glob as routine", () => {
    expect(classifyToolCall("Glob", {}, PROJECT, DEFAULT_APPROVAL_CONFIG)).toBe("routine");
  });

  it("classifies Grep as routine", () => {
    expect(classifyToolCall("Grep", {}, PROJECT, DEFAULT_APPROVAL_CONFIG)).toBe("routine");
  });

  it("classifies WebSearch as routine", () => {
    expect(classifyToolCall("WebSearch", {}, PROJECT, DEFAULT_APPROVAL_CONFIG)).toBe("routine");
  });
});

describe("classifyToolCall — constrained tools", () => {
  it("classifies Write as constrained", () => {
    expect(classifyToolCall("Write", {}, PROJECT, DEFAULT_APPROVAL_CONFIG)).toBe("constrained");
  });

  it("classifies Bash git status as constrained", () => {
    expect(classifyToolCall("Bash", { command: "git status" }, PROJECT, DEFAULT_APPROVAL_CONFIG)).toBe("constrained");
  });

  it("classifies Bash git diff as constrained", () => {
    expect(classifyToolCall("Bash", { command: "git diff" }, PROJECT, DEFAULT_APPROVAL_CONFIG)).toBe("constrained");
  });

  it("classifies Bash git log as constrained", () => {
    expect(classifyToolCall("Bash", { command: "git log --oneline" }, PROJECT, DEFAULT_APPROVAL_CONFIG)).toBe("constrained");
  });

  it("classifies Bash git add as constrained", () => {
    expect(classifyToolCall("Bash", { command: "git add ." }, PROJECT, DEFAULT_APPROVAL_CONFIG)).toBe("constrained");
  });

  it("classifies Bash git commit as constrained", () => {
    expect(classifyToolCall("Bash", { command: 'git commit -m "fix"' }, PROJECT, DEFAULT_APPROVAL_CONFIG)).toBe("constrained");
  });
});

describe("classifyToolCall — standard tools", () => {
  it("classifies Edit as standard", () => {
    expect(classifyToolCall("Edit", {}, PROJECT, DEFAULT_APPROVAL_CONFIG)).toBe("standard");
  });

  it("classifies WebFetch as standard", () => {
    expect(classifyToolCall("WebFetch", {}, PROJECT, DEFAULT_APPROVAL_CONFIG)).toBe("standard");
  });

  it("classifies Bash git push to non-main as standard", () => {
    expect(
      classifyToolCall("Bash", { command: "git push origin feature-branch" }, PROJECT, DEFAULT_APPROVAL_CONFIG),
    ).toBe("standard");
  });
});

describe("classifyToolCall — critical tools", () => {
  it("classifies Bash git push to main as critical", () => {
    expect(
      classifyToolCall("Bash", { command: "git push origin main" }, PROJECT, DEFAULT_APPROVAL_CONFIG),
    ).toBe("critical");
  });

  it("classifies Bash git reset --hard as critical", () => {
    expect(
      classifyToolCall("Bash", { command: "git reset --hard HEAD~1" }, PROJECT, DEFAULT_APPROVAL_CONFIG),
    ).toBe("critical");
  });

  it("classifies Bash rm command as critical", () => {
    expect(
      classifyToolCall("Bash", { command: "rm -rf dist/" }, PROJECT, DEFAULT_APPROVAL_CONFIG),
    ).toBe("critical");
  });
});

describe("classifyToolCall — fallback to default tier", () => {
  it("unknown tool falls back to default_tier (standard)", () => {
    expect(classifyToolCall("UnknownTool", {}, PROJECT, DEFAULT_APPROVAL_CONFIG)).toBe("standard");
  });

  it("respects custom default_tier in config", () => {
    const config: ApprovalConfig = {
      ...DEFAULT_APPROVAL_CONFIG,
      global: {
        ...DEFAULT_APPROVAL_CONFIG.global,
        default_tier: "routine",
        rules: [],
      },
    };
    expect(classifyToolCall("AnyTool", {}, PROJECT, config)).toBe("routine");
  });
});

describe("classifyToolCall — project-level rules override global", () => {
  it("project-level rule overrides global rule for Edit", () => {
    const config: ApprovalConfig = {
      ...DEFAULT_APPROVAL_CONFIG,
      projects: {
        "C:/GitHub/TestProject": {
          rules: [{ tool: "Edit", tier: "critical" }],
        },
      },
    };
    expect(classifyToolCall("Edit", {}, "C:/GitHub/TestProject", config)).toBe("critical");
  });

  it("global rule still applies for projects with no override", () => {
    const config: ApprovalConfig = {
      ...DEFAULT_APPROVAL_CONFIG,
      projects: {
        "C:/GitHub/OtherProject": {
          rules: [{ tool: "Edit", tier: "critical" }],
        },
      },
    };
    // TestProject has no override — falls back to global
    expect(classifyToolCall("Edit", {}, "C:/GitHub/TestProject", config)).toBe("standard");
  });

  it("normalizes backslash project path to match forward-slash key", () => {
    const config: ApprovalConfig = {
      ...DEFAULT_APPROVAL_CONFIG,
      projects: {
        "C:/GitHub/TestProject": {
          rules: [{ tool: "Write", tier: "critical" }],
        },
      },
    };
    // Supply backslash path — should be normalized
    expect(classifyToolCall("Write", {}, "C:\\GitHub\\TestProject", config)).toBe("critical");
  });

  it("first matching project rule wins", () => {
    const config: ApprovalConfig = {
      ...DEFAULT_APPROVAL_CONFIG,
      projects: {
        "C:/GitHub/TestProject": {
          rules: [
            { tool: "Bash", args_match: "git", tier: "routine" },
            { tool: "Bash", args_match: "git push", tier: "critical" },
          ],
        },
      },
    };
    // First rule matches git push — wins with "routine"
    expect(
      classifyToolCall("Bash", { command: "git push origin main" }, "C:/GitHub/TestProject", config),
    ).toBe("routine");
  });
});

describe("classifyToolCall — args_match regex", () => {
  it("args_match is tested against JSON.stringify(args)", () => {
    const config: ApprovalConfig = {
      global: {
        default_tier: "standard",
        timeout_seconds: 30,
        rules: [
          { tool: "Bash", args_match: '"command":"deploy"', tier: "critical" },
        ],
      },
      projects: {},
    };
    expect(
      classifyToolCall("Bash", { command: "deploy" }, PROJECT, config),
    ).toBe("critical");
  });

  it("rule without args_match matches on tool name alone", () => {
    const config: ApprovalConfig = {
      global: {
        default_tier: "standard",
        timeout_seconds: 30,
        rules: [{ tool: "Write", tier: "constrained" }],
      },
      projects: {},
    };
    // args is irrelevant when no args_match
    expect(classifyToolCall("Write", { file_path: "/any/path.ts" }, PROJECT, config)).toBe("constrained");
  });

  it("rule with args_match does NOT match when regex fails", () => {
    const config: ApprovalConfig = {
      global: {
        default_tier: "routine",
        timeout_seconds: 30,
        rules: [
          { tool: "Bash", args_match: "git push", tier: "critical" },
        ],
      },
      projects: {},
    };
    // no "git push" in the args — falls back to default
    expect(classifyToolCall("Bash", { command: "git status" }, PROJECT, config)).toBe("routine");
  });
});
