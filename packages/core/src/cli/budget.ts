import { Command } from "commander";
import { resolve } from "node:path";
import { checkBudget, resetBudget, loadBudgetConfig, saveBudgetConfig, listUsageRecords, MODEL_PRICING } from "../budget/index.js";
import { computeSpend, getPeriodStart } from "../budget/checker.js";
import type { BudgetPeriod } from "@nexus/shared";

const isTTY = process.stdout.isTTY ?? false;

function color(code: number, text: string): string {
  if (!isTTY) return text;
  return `\x1b[${code}m${text}\x1b[0m`;
}

function dim(text: string): string { return color(2, text); }
function green(text: string): string { return color(32, text); }
function yellow(text: string): string { return color(33, text); }
function red(text: string): string { return color(31, text); }
function cyan(text: string): string { return color(36, text); }

function formatUsd(amount: number): string {
  return `$${amount.toFixed(4)}`;
}

function formatTokens(n: number): string {
  return n.toLocaleString("en-US");
}

function normalizeProject(p: string): string {
  return resolve(p).replace(/\\/g, "/");
}

export const budgetCommand = new Command("budget")
  .description("Budget and token usage management");

// nexus budget status [--project <path>]
budgetCommand
  .command("status")
  .description("Show current spend and cap status for a project or globally")
  .option("--project <path>", "Project directory")
  .action(async (opts: { project?: string }) => {
    const project = opts.project ? normalizeProject(opts.project) : undefined;

    if (project) {
      const status = await checkBudget(project);
      const statusLabel =
        status.status === "ok" ? green("OK") :
        status.status === "soft_cap_reached" ? yellow("WARNING") :
        red("OVER LIMIT");

      process.stdout.write(`\n${cyan("Budget Status")} — ${dim(project)}\n`);
      process.stdout.write(dim("─────────────────────────────────────\n"));
      process.stdout.write(`Status:     ${statusLabel}\n`);
      process.stdout.write(`Period:     ${status.period}\n`);
      process.stdout.write(`Spent:      ${formatUsd(status.spent_usd)}\n`);
      process.stdout.write(`Soft cap:   ${status.soft_cap_usd !== null ? formatUsd(status.soft_cap_usd) : dim("none")}\n`);
      process.stdout.write(`Hard cap:   ${status.hard_cap_usd !== null ? formatUsd(status.hard_cap_usd) : dim("none")}\n`);
      if (status.remaining_usd !== null) {
        process.stdout.write(`Remaining:  ${formatUsd(status.remaining_usd)}\n`);
      }
      process.stdout.write("\n");
    } else {
      // Global status
      const config = await loadBudgetConfig();
      const records = await listUsageRecords();
      const period = config.global.period;
      const allProjects = new Set([
        ...records.map((r) => r.project),
        ...Object.keys(config.projects),
      ]);

      process.stdout.write(`\n${cyan("Global Budget Status")}\n`);
      process.stdout.write(dim("─────────────────────────────────────\n"));
      process.stdout.write(`Period:     ${period}\n`);
      process.stdout.write(`Soft cap:   ${config.global.soft_cap_usd !== null ? formatUsd(config.global.soft_cap_usd) : dim("none")}\n`);
      process.stdout.write(`Hard cap:   ${config.global.hard_cap_usd !== null ? formatUsd(config.global.hard_cap_usd) : dim("none")}\n\n`);

      if (allProjects.size === 0) {
        process.stdout.write(dim("No projects tracked yet.\n\n"));
        return;
      }

      // Show per-project summary
      for (const proj of Array.from(allProjects).sort()) {
        const summary = computeSpend(records, proj, period);
        process.stdout.write(`${dim(proj)}\n`);
        process.stdout.write(`  Spent:  ${formatUsd(summary.total_cost_usd)}  (${formatTokens(summary.total_input_tokens + summary.total_output_tokens)} tokens, ${summary.session_count} sessions)\n`);
      }
      process.stdout.write("\n");
    }
  });

// nexus budget history [--project <path>] [--days <n>]
budgetCommand
  .command("history")
  .description("Show spend history grouped by day (default: last 7 days)")
  .option("--project <path>", "Project directory")
  .option("--days <n>", "Number of days to show", "7")
  .action(async (opts: { project?: string; days: string }) => {
    const project = opts.project ? normalizeProject(opts.project) : undefined;
    const days = Math.max(1, parseInt(opts.days, 10) || 7);

    const records = await listUsageRecords(project ? { project } : undefined);

    const now = new Date();
    const buckets: Array<{ date: string; cost: number; inputTokens: number; outputTokens: number }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 0, 0, 0, 0);
      const dayStart = d.toISOString();
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).toISOString();

      const dayRecords = records.filter((r) => r.timestamp >= dayStart && r.timestamp < dayEnd);
      const cost = dayRecords.reduce((sum, r) => sum + r.estimated_cost_usd, 0);
      const inputTokens = dayRecords.reduce((sum, r) => sum + r.input_tokens + r.cache_read_tokens + r.cache_creation_tokens, 0);
      const outputTokens = dayRecords.reduce((sum, r) => sum + r.output_tokens, 0);

      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");

      buckets.push({ date: `${yyyy}-${mm}-${dd}`, cost, inputTokens, outputTokens });
    }

    const title = project ? `${cyan("Spend History")} — ${dim(project)}` : cyan("Spend History (All Projects)");
    process.stdout.write(`\n${title}\n`);
    process.stdout.write(dim("─────────────────────────────────────────────────────\n"));
    process.stdout.write(dim("Date        Cost       Input Tokens  Output Tokens\n"));
    process.stdout.write(dim("─────────────────────────────────────────────────────\n"));

    for (const b of buckets) {
      const costStr = b.cost > 0 ? formatUsd(b.cost).padEnd(10) : dim("—".padEnd(10));
      const inStr = b.inputTokens > 0 ? formatTokens(b.inputTokens).padEnd(14) : dim("—".padEnd(14));
      const outStr = b.outputTokens > 0 ? formatTokens(b.outputTokens) : dim("—");
      process.stdout.write(`${b.date}  ${costStr} ${inStr} ${outStr}\n`);
    }
    process.stdout.write("\n");
  });

// nexus budget set --soft <usd> --hard <usd> [--project <path>] [--period ...]
budgetCommand
  .command("set")
  .description("Set budget caps for a project or globally")
  .option("--project <path>", "Project directory (omit for global)")
  .option("--soft <usd>", "Soft cap in USD (warn when exceeded)")
  .option("--hard <usd>", "Hard cap in USD (block when exceeded)")
  .option("--period <period>", "Budget period: daily|weekly|monthly|all-time", "daily")
  .action(async (opts: { project?: string; soft?: string; hard?: string; period: string }) => {
    if (!opts.soft && !opts.hard) {
      process.stderr.write("Error: provide --soft and/or --hard\n");
      process.exit(1);
    }

    const validPeriods: BudgetPeriod[] = ["daily", "weekly", "monthly", "all-time"];
    if (!validPeriods.includes(opts.period as BudgetPeriod)) {
      process.stderr.write(`Error: invalid period "${opts.period}". Must be one of: ${validPeriods.join(", ")}\n`);
      process.exit(1);
    }

    const softCap = opts.soft !== undefined ? parseFloat(opts.soft) : null;
    const hardCap = opts.hard !== undefined ? parseFloat(opts.hard) : null;

    if (softCap !== null && isNaN(softCap)) {
      process.stderr.write(`Error: invalid --soft value "${opts.soft}"\n`);
      process.exit(1);
    }
    if (hardCap !== null && isNaN(hardCap)) {
      process.stderr.write(`Error: invalid --hard value "${opts.hard}"\n`);
      process.exit(1);
    }

    const config = await loadBudgetConfig();
    const period = opts.period as BudgetPeriod;

    if (opts.project) {
      const project = normalizeProject(opts.project);
      if (!config.projects[project]) {
        config.projects[project] = {};
      }
      if (softCap !== null) config.projects[project]!.soft_cap_usd = softCap;
      if (hardCap !== null) config.projects[project]!.hard_cap_usd = hardCap;
      config.projects[project]!.period = period;
      await saveBudgetConfig(config);
      process.stdout.write(`Budget set for ${cyan(project)}:\n`);
    } else {
      if (softCap !== null) config.global.soft_cap_usd = softCap;
      if (hardCap !== null) config.global.hard_cap_usd = hardCap;
      config.global.period = period;
      await saveBudgetConfig(config);
      process.stdout.write(`Global budget set:\n`);
    }

    if (softCap !== null) process.stdout.write(`  Soft cap: ${green(formatUsd(softCap))}\n`);
    if (hardCap !== null) process.stdout.write(`  Hard cap: ${red(formatUsd(hardCap))}\n`);
    process.stdout.write(`  Period:   ${period}\n`);
    process.stdout.write("\n");
  });

// nexus budget reset [--project <path>]
budgetCommand
  .command("reset")
  .description("Reset spend counters for current period (does not delete usage records)")
  .option("--project <path>", "Project directory (omit for global reset)")
  .action(async (opts: { project?: string }) => {
    const project = opts.project ? normalizeProject(opts.project) : undefined;
    await resetBudget(project);

    if (project) {
      process.stdout.write(`Budget reset for ${cyan(project)}\n`);
    } else {
      process.stdout.write(`Global budget reset\n`);
    }
    process.stdout.write(dim("Usage records are preserved. Run 'nexus budget status' to confirm.\n\n"));
  });

// nexus budget pricing
budgetCommand
  .command("pricing")
  .description("Show the model pricing table (per 1K tokens)")
  .action(() => {
    process.stdout.write(`\n${cyan("Model Pricing Table")} ${dim("(per 1K tokens)")}\n`);
    process.stdout.write(dim("─────────────────────────────────────────────────────────────────────────\n"));
    process.stdout.write(dim("Model                    Input       Output      Cache Read  Cache Write\n"));
    process.stdout.write(dim("─────────────────────────────────────────────────────────────────────────\n"));

    for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
      const m = model.padEnd(24);
      const i = formatUsd(pricing.input).padEnd(12);
      const o = formatUsd(pricing.output).padEnd(12);
      const cr = formatUsd(pricing.cache_read).padEnd(12);
      const cc = formatUsd(pricing.cache_creation);
      process.stdout.write(`${m} ${i}${o}${cr}${cc}\n`);
    }

    process.stdout.write(dim("\nLast updated: 2026-04-27\n"));
    process.stdout.write(dim("Unknown models default to $0 cost. Update packages/core/src/budget/pricing.ts to add new models.\n\n"));
  });

// Also expose getPeriodStart for testing/use
export { getPeriodStart };
