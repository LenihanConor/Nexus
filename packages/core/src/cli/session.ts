import { Command } from "commander";
import type { SessionRecord, SessionStatus, SessionTreeNode } from "@nexus/shared";
import { formatDuration } from "@nexus/shared";
import {
  listSessions,
  getSession,
  getLineage,
  detectStaleSessions,
  endSession,
} from "../session/index.js";
import { buildSessionTree } from "../session/lineage.js";

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

function statusIcon(status: SessionStatus): string {
  switch (status) {
    case "running": return green("●");
    case "paused": return yellow("◐");
    case "completed": return dim("○");
    case "failed": return red("✖");
    case "interrupted": return red("◌");
    case "stale": return yellow("◌");
    default: return "?";
  }
}

function formatProjectName(project: string): string {
  const parts = project.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? project;
}

function formatSessionDuration(session: SessionRecord): string {
  if (session.duration_ms !== null) return formatDuration(session.duration_ms);
  const elapsed = Date.now() - new Date(session.created_at).getTime();
  return formatDuration(elapsed);
}

function formatSessionTable(sessions: SessionRecord[]): string {
  if (sessions.length === 0) return "No sessions found.\n";

  const header = `${dim("STATUS".padEnd(10))}${dim("AGENT".padEnd(14))}${dim("PROJECT".padEnd(14))}${dim("TASK".padEnd(30))}${dim("DURATION")}`;
  const rows = sessions.map((s) => {
    const icon = statusIcon(s.status);
    const status = `${icon} ${s.status}`.padEnd(isTTY ? 19 : 10);
    const agent = s.agent_type.padEnd(14);
    const project = formatProjectName(s.project).padEnd(14);
    const task = s.task_description.slice(0, 28).padEnd(30);
    const duration = formatSessionDuration(s);
    return `${status}${agent}${project}${task}${duration}`;
  });

  return [header, ...rows].join("\n") + "\n";
}

function renderTree(node: SessionTreeNode, targetId?: string, prefix = "", isLast = true): string {
  const s = node.session;
  const icon = statusIcon(s.status);
  const marker = s.id === targetId ? cyan(" ← current") : "";
  const connector = prefix === "" ? "" : isLast ? "└── " : "├── ";
  const dur = formatSessionDuration(s);

  let line = `${prefix}${connector}${icon} ${s.id.slice(0, 8)} "${s.task_description}" (${dur}, ${s.status})${marker}\n`;

  const childPrefix = prefix === "" ? "" : prefix + (isLast ? "    " : "│   ");
  for (let i = 0; i < node.children.length; i++) {
    line += renderTree(
      node.children[i]!,
      targetId,
      childPrefix,
      i === node.children.length - 1,
    );
  }

  return line;
}

export const sessionCommand = new Command("session")
  .description("Manage agent sessions");

sessionCommand
  .command("list")
  .description("List recent sessions")
  .option("--limit <n>", "Number of sessions", "20")
  .option("--status <status>", "Filter by status")
  .option("--project <path>", "Filter by project")
  .option("--agent <type>", "Filter by agent type")
  .option("--from <date>", "Created after date")
  .option("--to <date>", "Created before date")
  .option("--json", "Raw JSON output")
  .action(async (opts) => {
    const filters: Parameters<typeof listSessions>[0] = {
      limit: Number(opts.limit),
    };
    if (opts.status) filters.status = opts.status as SessionStatus;
    if (opts.project) filters.project = opts.project;
    if (opts.agent) filters.agent_type = opts.agent;
    if (opts.from) filters.from = opts.from;
    if (opts.to) filters.to = opts.to;

    const sessions = await listSessions(filters);

    if (opts.json) {
      for (const s of sessions) process.stdout.write(JSON.stringify(s) + "\n");
    } else {
      process.stdout.write(formatSessionTable(sessions));
    }
  });

sessionCommand
  .command("show <session-id>")
  .description("Show full session detail")
  .option("--json", "Raw JSON output")
  .action(async (sessionId, opts) => {
    const session = await getSession(sessionId);
    if (!session) {
      process.stderr.write(`Session ${sessionId} not found.\n`);
      process.exitCode = 1;
      return;
    }

    if (opts.json) {
      process.stdout.write(JSON.stringify(session) + "\n");
      return;
    }

    const icon = statusIcon(session.status);
    process.stdout.write(`Session: ${session.id}\n`);
    process.stdout.write(`Status:      ${icon} ${session.status}\n`);
    process.stdout.write(`Agent:       ${session.agent_type}${session.agent_pid ? ` (PID ${session.agent_pid})` : ""}\n`);
    process.stdout.write(`Project:     ${session.project}\n`);
    process.stdout.write(`Task:        ${session.task_description}\n`);
    process.stdout.write(`Started:     ${session.created_at}\n`);
    if (session.duration_ms !== null) {
      process.stdout.write(`Duration:    ${formatDuration(session.duration_ms)}\n`);
    }
    process.stdout.write(`Correlation: ${session.correlation_id}\n`);
    if (session.parent_id) {
      process.stdout.write(`Parent:      ${session.parent_id}\n`);
    }

    if (session.snapshots.length > 0) {
      process.stdout.write(`\nSnapshots:\n`);
      for (const snap of session.snapshots) {
        const time = new Date(snap.timestamp).toLocaleTimeString("en-GB", { hour12: false });
        process.stdout.write(`  ${dim(time)}  ${snap.label}`);
        if (snap.task_progress) process.stdout.write(` — ${snap.task_progress}`);
        process.stdout.write("\n");
        if (snap.files_changed.length > 0) {
          process.stdout.write(`         Files: ${snap.files_changed.join(", ")}\n`);
        }
        for (const d of snap.decisions) {
          process.stdout.write(`         Decision: ${d}\n`);
        }
      }
    }

    if (Object.keys(session.metadata).length > 0) {
      process.stdout.write(`\nMetadata:\n`);
      for (const [key, value] of Object.entries(session.metadata)) {
        process.stdout.write(`  ${key}: ${JSON.stringify(value)}\n`);
      }
    }
  });

sessionCommand
  .command("lineage <session-id>")
  .description("Show session lineage tree")
  .option("--json", "Raw JSON output")
  .action(async (sessionId, opts) => {
    try {
      const lineage = await getLineage(sessionId);

      if (opts.json) {
        process.stdout.write(JSON.stringify(lineage) + "\n");
        return;
      }

      const target = lineage.path_to_target[lineage.path_to_target.length - 1]!;
      process.stdout.write(`Session Lineage: ${sessionId}\n`);
      process.stdout.write(`Correlation: ${target.correlation_id} — "${target.task_description}"\n\n`);

      const allSessions = [...lineage.path_to_target, ...lineage.descendants];
      const unique = [...new Map(allSessions.map((s) => [s.id, s])).values()];
      const tree = buildSessionTree(unique);

      if (tree) {
        process.stdout.write(renderTree(tree, sessionId));
      }
    } catch (err) {
      process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    }
  });

sessionCommand
  .command("clean")
  .description("Clean up stale sessions")
  .option("--stale", "Mark stale sessions as interrupted")
  .option("--all", "Skip per-session confirmation")
  .option("--dry-run", "Preview what would be cleaned")
  .action(async (opts) => {
    if (!opts.stale) {
      process.stderr.write("Use --stale to clean stale sessions.\n");
      process.exitCode = 1;
      return;
    }

    const stale = await detectStaleSessions();
    if (stale.length === 0) {
      process.stdout.write("No stale sessions found.\n");
      return;
    }

    if (opts.dryRun) {
      process.stdout.write(`Would mark ${stale.length} session(s) as interrupted:\n`);
      for (const s of stale) {
        process.stdout.write(`  ${s.id.slice(0, 8)} ${s.agent_type} — "${s.task_description}"\n`);
      }
      return;
    }

    for (const s of stale) {
      try {
        await endSession(s.id, { status: "interrupted" });
        process.stdout.write(green(`Cleaned: ${s.id.slice(0, 8)} "${s.task_description}"\n`));
      } catch (err) {
        process.stderr.write(red(`Failed: ${s.id.slice(0, 8)} — ${err instanceof Error ? err.message : String(err)}\n`));
      }
    }

    process.stdout.write(dim("\nTip: also run `nexus worktree clean --stale` to clean orphaned worktrees.\n"));
  });
