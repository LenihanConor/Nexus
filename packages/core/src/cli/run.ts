import { Command } from "commander";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { formatDuration } from "@nexus/shared";
import { getAdapter, registerAdapter } from "../adapter/registry.js";
import { ClaudeCodeAdapter } from "../adapter/claude-code.js";
import { runAgent, mapExitToStatus } from "../adapter/runner.js";

const isTTY = process.stdout.isTTY ?? false;

function color(code: number, text: string): string {
  if (!isTTY) return text;
  return `\x1b[${code}m${text}\x1b[0m`;
}

function dim(text: string): string { return color(2, text); }
function green(text: string): string { return color(32, text); }
function red(text: string): string { return color(31, text); }
function yellow(text: string): string { return color(33, text); }
function cyan(text: string): string { return color(36, text); }

const AGENT_COMMANDS: Record<string, string> = {
  "claude-code": "claude",
  "aider": "aider",
};

function slugifyTask(task: string): string {
  return task
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function commandExists(cmd: string): boolean {
  try {
    const which = process.platform === "win32" ? "where" : "which";
    execSync(`${which} ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

registerAdapter(new ClaudeCodeAdapter());

export const runCommand = new Command("run")
  .description("Run an agent wrapped in a Nexus adapter session")
  .argument("<agent-type>", "Agent type (claude-code, aider, or a raw command)")
  .argument("[agent-args...]", "Arguments passed to the agent")
  .requiredOption("--project <path>", "Project root directory")
  .requiredOption("--task <description>", "Task description")
  .option("--branch <name>", "Worktree branch name (auto-generated if omitted)")
  .option("--scope <paths>", "Comma-separated scope paths")
  .option("--parent <session-id>", "Parent session ID for lineage")
  .option("--correlation <id>", "Correlation ID for grouping")
  .option("--no-worktree", "Skip worktree creation")
  .option("--no-merge", "Don't auto-merge on completion")
  .option("--merge-strategy <strategy>", "Merge strategy: merge|fast-forward|rebase", "merge")
  .action(async (agentType: string, agentArgs: string[], opts: {
    project: string;
    task: string;
    branch?: string;
    scope?: string;
    parent?: string;
    correlation?: string;
    worktree: boolean;
    merge: boolean;
    mergeStrategy: string;
  }) => {
    const project = resolve(opts.project);
    const agentCmd = AGENT_COMMANDS[agentType] ?? agentType;

    if (!commandExists(agentCmd)) {
      process.stderr.write(
        `Error: '${agentCmd}' not found. Install it or provide the full path.\n`,
      );
      process.exit(1);
    }

    const branch = opts.branch ?? (opts.worktree ? `feature/${slugifyTask(opts.task)}` : undefined);
    const scope = opts.scope?.split(",").map((s) => s.trim());

    const adapter = getAdapter(agentType);

    process.stdout.write(dim("Nexus: starting adapter session...\n"));

    const session = await adapter.start({
      project,
      branch,
      task: opts.task,
      scope,
      parentSessionId: opts.parent,
      correlationId: opts.correlation,
      noWorktree: !opts.worktree,
      metadata: { agent_command: agentCmd },
    });

    const cwd = session.worktreePath ?? project;

    process.stdout.write(
      dim(`Nexus: session ${cyan(session.sessionId.slice(0, 8))} started`) +
      (session.worktreePath ? dim(` in ${session.branch}\n`) : dim("\n")),
    );

    const result = await runAgent({
      command: agentCmd,
      args: agentArgs,
      cwd,
      adapter,
      session,
    });

    const status = mapExitToStatus(result);
    const mergeStrategy = !opts.merge || status !== "completed" ? "skip" : opts.mergeStrategy as "merge" | "fast-forward" | "rebase";

    await adapter.end(session, {
      status,
      exitCode: result.exitCode,
      mergeStrategy,
    });

    const statusColor = status === "completed" ? green : status === "failed" ? red : yellow;
    const duration = formatDuration(result.durationMs);

    process.stdout.write("\n" + dim("───────────────────────────────────────\n"));
    process.stdout.write(`Nexus: session ${cyan(session.sessionId.slice(0, 8))} ${statusColor(status)}\n`);
    process.stdout.write(dim(`  Duration:  ${duration}\n`));
    if (session.worktreeId) {
      const wtStatus = mergeStrategy === "skip" ? "not merged" : "merged";
      process.stdout.write(dim(`  Worktree:  ${wtStatus}\n`));
    }
    process.stdout.write(dim("───────────────────────────────────────\n"));

    process.exit(result.exitCode);
  });
