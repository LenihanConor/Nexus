import type { ApprovalTier, ApprovalConfig, ApprovalRule } from "@nexus/shared";

function normalizeProject(project: string): string {
  return project.replace(/\\/g, "/");
}

function matchesRule(
  rule: ApprovalRule,
  tool: string,
  args: Record<string, unknown>,
): boolean {
  if (rule.tool !== tool) return false;
  if (rule.args_match !== undefined) {
    const serialized = JSON.stringify(args);
    const regex = new RegExp(rule.args_match);
    if (!regex.test(serialized)) return false;
  }
  return true;
}

export function classifyToolCall(
  tool: string,
  args: Record<string, unknown>,
  project: string,
  config: ApprovalConfig,
): ApprovalTier {
  const normalizedProject = normalizeProject(project);

  // Check project-level rules first
  const projectConfig = config.projects[normalizedProject];
  if (projectConfig?.rules) {
    for (const rule of projectConfig.rules) {
      if (matchesRule(rule, tool, args)) {
        return rule.tier;
      }
    }
  }

  // Fall back to global rules
  for (const rule of config.global.rules) {
    if (matchesRule(rule, tool, args)) {
      return rule.tier;
    }
  }

  return config.global.default_tier;
}
