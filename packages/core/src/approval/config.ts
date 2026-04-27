import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { ApprovalConfig } from "@nexus/shared";
import { getNexusDir } from "../audit/emitter.js";

export const DEFAULT_APPROVAL_CONFIG: ApprovalConfig = {
  global: {
    default_tier: "standard",
    timeout_seconds: 30,
    rules: [
      { tool: "Read", tier: "routine" },
      { tool: "Glob", tier: "routine" },
      { tool: "Grep", tier: "routine" },
      { tool: "WebSearch", tier: "routine" },
      { tool: "Bash", args_match: "git (status|diff|log|add|commit)", tier: "constrained" },
      { tool: "Bash", args_match: "git push(?!.*main)", tier: "standard" },
      { tool: "Bash", args_match: "git push.*main", tier: "critical" },
      { tool: "Bash", args_match: "git reset --hard", tier: "critical" },
      { tool: "Bash", args_match: "rm ", tier: "critical" },
      { tool: "Write", tier: "constrained" },
      { tool: "Edit", tier: "standard" },
      { tool: "WebFetch", tier: "standard" },
    ],
  },
  projects: {},
};

export function getApprovalConfigPath(): string {
  return join(getNexusDir(), "approval.json");
}

export async function loadApprovalConfig(): Promise<ApprovalConfig> {
  const configPath = getApprovalConfigPath();
  try {
    const raw = await readFile(configPath, "utf-8");
    return JSON.parse(raw) as ApprovalConfig;
  } catch {
    return DEFAULT_APPROVAL_CONFIG;
  }
}

export async function saveApprovalConfig(config: ApprovalConfig): Promise<void> {
  const configPath = getApprovalConfigPath();
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}
