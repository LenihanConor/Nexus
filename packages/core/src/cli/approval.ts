import { Command } from "commander";
import { randomUUID } from "node:crypto";
import type { PendingApproval } from "@nexus/shared";
import {
  listPending,
  resolvePending,
  writeResolution,
  cleanStalePending,
  loadApprovalConfig,
} from "../approval/index.js";
import { emitEvent } from "../audit/emitter.js";
import { query } from "../audit/index.js";

const isTTY = process.stdout.isTTY ?? false;

function color(code: number, text: string): string {
  if (!isTTY) return text;
  return `\x1b[${code}m${text}\x1b[0m`;
}

function dim(text: string): string { return color(2, text); }
function yellow(text: string): string { return color(33, text); }
function red(text: string): string { return color(31, text); }
function cyan(text: string): string { return color(36, text); }

function formatWaitingSince(requestedAt: string): string {
  const elapsed = Date.now() - new Date(requestedAt).getTime();
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function formatTimeout(entry: PendingApproval): string {
  if (!entry.timeout_at) return "—";
  const remaining = new Date(entry.timeout_at).getTime() - Date.now();
  if (remaining <= 0) return red("expired");
  return `${Math.ceil(remaining / 1000)}s`;
}

function formatQueue(pending: PendingApproval[]): string {
  if (pending.length === 0) return "No pending approvals.\n";

  const header = [
    dim("ID".padEnd(10)),
    dim("TOOL".padEnd(20)),
    dim("TIER".padEnd(14)),
    dim("SESSION".padEnd(10)),
    dim("WAITING".padEnd(12)),
    dim("TIMEOUT"),
  ].join("");

  const rows = pending.map((p) => {
    const id = cyan(p.id.slice(0, 8)).padEnd(isTTY ? 18 : 10);
    const tool = p.tool.padEnd(20);
    const tier = p.tier.padEnd(14);
    const session = p.session_id.slice(0, 8).padEnd(10);
    const waiting = formatWaitingSince(p.requested_at).padEnd(12);
    const timeout = formatTimeout(p);
    return `${id}${tool}${tier}${session}${waiting}${timeout}`;
  });

  return [header, ...rows].join("\n") + "\n";
}

export const approvalCommand = new Command("approval")
  .description("Manage approval requests");

approvalCommand
  .command("queue")
  .description("List pending approval requests")
  .option("--json", "Raw JSON output")
  .action(async (opts) => {
    // Clean up stale entries before listing
    await cleanStalePending();
    const pending = await listPending();

    if (opts.json) {
      process.stdout.write(JSON.stringify(pending) + "\n");
    } else {
      process.stdout.write(formatQueue(pending));
    }
  });

approvalCommand
  .command("history")
  .description("Show approval events from audit trail")
  .option("--days <n>", "Number of days back", "7")
  .option("--session <id>", "Filter by session ID")
  .option("--json", "Raw JSON output")
  .action(async (opts) => {
    const days = Number(opts.days);
    const fromDate = new Date(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate() - days,
      ),
    ).toISOString();

    const filters: Parameters<typeof query>[0] = {
      event_type: "approval",
      from: fromDate,
      limit: 200,
    };
    if (opts.session) filters.session_id = opts.session;

    const events = await query(filters);

    if (opts.json) {
      for (const e of events) {
        process.stdout.write(JSON.stringify(e) + "\n");
      }
      return;
    }

    if (events.length === 0) {
      process.stdout.write("No approval events found.\n");
      return;
    }

    for (const e of events) {
      const time = new Date(e.timestamp).toLocaleTimeString("en-GB", { hour12: false });
      const payload = e.payload as Record<string, unknown>;
      const tool = (payload.tool as string | undefined) ?? "unknown";
      process.stdout.write(`${dim(time)}  ${cyan(e.event_type.padEnd(28))}  ${tool}\n`);
    }
  });

approvalCommand
  .command("rules")
  .description("Print active rule set")
  .option("--project <path>", "Show project-level overrides for path")
  .option("--json", "Raw JSON output")
  .action(async (opts) => {
    const config = await loadApprovalConfig();

    if (opts.json) {
      process.stdout.write(JSON.stringify(config, null, 2) + "\n");
      return;
    }

    process.stdout.write(`Default tier: ${cyan(config.global.default_tier)}\n`);
    process.stdout.write(`Timeout:      ${config.global.timeout_seconds}s\n\n`);

    if (opts.project) {
      const normalizedProject = opts.project.replace(/\\/g, "/");
      const projectConfig = config.projects[normalizedProject];
      if (projectConfig?.rules && projectConfig.rules.length > 0) {
        process.stdout.write(`Project rules for ${normalizedProject}:\n`);
        for (const rule of projectConfig.rules) {
          const argsMatch = rule.args_match ? ` [args: ${rule.args_match}]` : "";
          process.stdout.write(`  ${rule.tool.padEnd(16)} → ${yellow(rule.tier)}${argsMatch}\n`);
        }
        process.stdout.write("\n");
      } else {
        process.stdout.write(`No project-level rules for ${normalizedProject}.\n\n`);
      }
    }

    process.stdout.write("Global rules:\n");
    for (const rule of config.global.rules) {
      const argsMatch = rule.args_match ? ` [args: ${rule.args_match}]` : "";
      process.stdout.write(`  ${rule.tool.padEnd(16)} → ${yellow(rule.tier)}${argsMatch}\n`);
    }
  });

// Top-level approve command
export const approveCommand = new Command("approve")
  .description("Approve a pending request")
  .argument("<id>", "Approval request ID")
  .action(async (id: string) => {
    const pending = await listPending();

    // Support partial ID (first 8 chars)
    const entry = pending.find(
      (p) => p.id === id || p.id.startsWith(id),
    );

    if (!entry) {
      process.stderr.write(`No pending approval found with ID: ${id}\n`);
      process.exitCode = 1;
      return;
    }

    const resolvedAt = new Date().toISOString();
    await writeResolution(entry.id, { approved: true, resolved_at: resolvedAt });
    await resolvePending(entry.id, { approved: true, resolved_at: resolvedAt });

    await emitEvent(
      "approval.human_approved",
      entry.session_id,
      { session_id: entry.session_id, approval_id: entry.id, tool: entry.tool },
      { project: entry.project },
    );

    process.stdout.write(`Approved: ${entry.id.slice(0, 8)} (${entry.tool})\n`);
  });

// Top-level reject command
export const rejectCommand = new Command("reject")
  .description("Reject a pending request")
  .argument("<id>", "Approval request ID")
  .option("--reason <text>", "Reason for rejection")
  .action(async (id: string, opts: { reason?: string }) => {
    const pending = await listPending();

    const entry = pending.find(
      (p) => p.id === id || p.id.startsWith(id),
    );

    if (!entry) {
      process.stderr.write(`No pending approval found with ID: ${id}\n`);
      process.exitCode = 1;
      return;
    }

    const resolvedAt = new Date().toISOString();
    await writeResolution(entry.id, {
      approved: false,
      reason: opts.reason,
      resolved_at: resolvedAt,
    });
    await resolvePending(entry.id, {
      approved: false,
      reason: opts.reason,
      resolved_at: resolvedAt,
    });

    await emitEvent(
      "approval.rejected",
      entry.session_id,
      {
        session_id: entry.session_id,
        approval_id: entry.id,
        tool: entry.tool,
        reason: opts.reason ?? null,
      },
      { project: entry.project },
    );

    process.stdout.write(`Rejected: ${entry.id.slice(0, 8)} (${entry.tool})${opts.reason ? ` — ${opts.reason}` : ""}\n`);
  });
