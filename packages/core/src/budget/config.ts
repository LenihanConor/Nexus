import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getNexusDir } from "../audit/emitter.js";
import type { BudgetConfig } from "@nexus/shared";

function budgetConfigPath(): string {
  return join(getNexusDir(), "budget.json");
}

const DEFAULTS: BudgetConfig = {
  global: {
    soft_cap_usd: null,
    hard_cap_usd: null,
    period: "daily",
  },
  projects: {},
};

export async function loadBudgetConfig(): Promise<BudgetConfig> {
  let raw: string;
  try {
    raw = await readFile(budgetConfigPath(), "utf-8");
  } catch {
    return structuredClone(DEFAULTS);
  }

  let parsed: Partial<BudgetConfig>;
  try {
    parsed = JSON.parse(raw) as Partial<BudgetConfig>;
  } catch {
    return structuredClone(DEFAULTS);
  }

  return {
    global: {
      soft_cap_usd: parsed.global?.soft_cap_usd ?? null,
      hard_cap_usd: parsed.global?.hard_cap_usd ?? null,
      period: parsed.global?.period ?? "daily",
    },
    projects: parsed.projects ?? {},
  };
}

export async function saveBudgetConfig(config: BudgetConfig): Promise<void> {
  const dir = getNexusDir();
  await mkdir(dir, { recursive: true });
  await writeFile(budgetConfigPath(), JSON.stringify(config, null, 2) + "\n");
}
