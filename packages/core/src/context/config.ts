import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getNexusDir } from "../audit/emitter.js";
import type { ContextHealthConfig } from "@nexus/shared";

const DEFAULTS: ContextHealthConfig = {
  warn_at_percent: 80,
  critical_at_percent: 95,
};

function configPath(): string {
  return join(getNexusDir(), "config.json");
}

export async function loadContextConfig(): Promise<ContextHealthConfig> {
  let raw: string;
  try {
    raw = await readFile(configPath(), "utf-8");
  } catch {
    return { ...DEFAULTS };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ...DEFAULTS };
  }

  const context = parsed["context"] as Partial<ContextHealthConfig> | undefined;
  if (!context) {
    return { ...DEFAULTS };
  }

  const warn =
    typeof context.warn_at_percent === "number"
      ? context.warn_at_percent
      : DEFAULTS.warn_at_percent;

  const critical =
    typeof context.critical_at_percent === "number"
      ? context.critical_at_percent
      : DEFAULTS.critical_at_percent;

  if (warn >= critical) {
    process.stderr.write(
      `[nexus] Warning: Invalid context thresholds (warn_at_percent ${warn} >= critical_at_percent ${critical}). Using defaults.\n`,
    );
    return { ...DEFAULTS };
  }

  return { warn_at_percent: warn, critical_at_percent: critical };
}

export async function saveContextConfig(config: ContextHealthConfig): Promise<void> {
  const dir = getNexusDir();
  await mkdir(dir, { recursive: true });

  let existing: Record<string, unknown> = {};
  try {
    const raw = await readFile(configPath(), "utf-8");
    existing = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // File doesn't exist or is invalid — start fresh
  }

  existing["context"] = config;
  await writeFile(configPath(), JSON.stringify(existing, null, 2) + "\n");
}
