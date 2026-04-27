import { Command } from "commander";
import type { WorktreeRecord, WorktreeStatus } from "@nexus/shared";
import {
  listWorktrees,
  createWorktree,
  mergeWorktree,
  cleanupWorktree,
  detectStaleWorktrees,
} from "../worktree/index.js";

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

function colorStatus(status: WorktreeStatus): string {
  switch (status) {
    case "active": return green(status);
    case "completed": return cyan(status);
    case "merged": return dim(status);
    case "conflict": return red(status);
    case "stale": return yellow(status);
    case "cleaned": return dim(status);
    default: return status;
  }
}

function formatProjectName(project: string): string {
  const parts = project.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? project;
}

function formatWorktreeTable(worktrees: WorktreeRecord[]): string {
  if (worktrees.length === 0) return "No worktrees found.\n";

  const header = `${dim("PROJECT".padEnd(16))}${dim("BRANCH".padEnd(28))}${dim("STATUS".padEnd(14))}${dim("SESSION")}`;
  const rows = worktrees.map((wt) => {
    const project = formatProjectName(wt.project).padEnd(16);
    const branch = wt.branch.padEnd(28);
    const status = colorStatus(wt.status).padEnd(isTTY ? 23 : 14);
    const session = wt.session_id.slice(0, 12);
    return `${project}${branch}${status}${session}`;
  });

  return [header, ...rows].join("\n") + "\n";
}

export const worktreeCommand = new Command("worktree")
  .description("Manage git worktrees for agent isolation");

worktreeCommand
  .command("list")
  .description("List worktrees")
  .option("--project <path>", "Filter by project")
  .option("--status <status>", "Filter by status")
  .option("--json", "Raw JSON output")
  .action(async (opts) => {
    const filters: { project?: string; status?: WorktreeStatus } = {};
    if (opts.project) filters.project = opts.project;
    if (opts.status) filters.status = opts.status as WorktreeStatus;

    const worktrees = await listWorktrees(filters);

    if (opts.json) {
      for (const wt of worktrees) {
        process.stdout.write(JSON.stringify(wt) + "\n");
      }
    } else {
      process.stdout.write(formatWorktreeTable(worktrees));
    }
  });

worktreeCommand
  .command("create")
  .description("Create a new worktree")
  .requiredOption("--project <path>", "Project path")
  .requiredOption("--branch <name>", "Branch name (feature/, bugfix/, or docs/)")
  .requiredOption("--session <id>", "Owning session ID")
  .option("--parent <branch>", "Parent branch")
  .option("--scope <paths...>", "Declared file scope")
  .option("--json", "Raw JSON output")
  .action(async (opts) => {
    try {
      const { record, conflicts } = await createWorktree({
        session_id: opts.session,
        project: opts.project,
        branch: opts.branch,
        parent_branch: opts.parent,
        scope: opts.scope,
      });

      if (opts.json) {
        process.stdout.write(JSON.stringify({ record, conflicts }) + "\n");
      } else {
        process.stdout.write(`Created worktree ${record.id}\n`);
        process.stdout.write(`  Branch: ${record.branch}\n`);
        process.stdout.write(`  Path:   ${record.path}\n`);
        if (conflicts.has_conflicts) {
          process.stdout.write(yellow("\n  Warning: scope conflicts detected:\n"));
          for (const c of conflicts.conflicts) {
            process.stdout.write(`    ${c.branch}: ${c.overlapping_paths.join(", ")}\n`);
          }
        }
      }
    } catch (err) {
      process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    }
  });

worktreeCommand
  .command("merge <worktree-id>")
  .description("Merge a worktree back to its parent branch")
  .option("--strategy <type>", "Merge strategy: merge, fast-forward, rebase", "merge")
  .option("--json", "Raw JSON output")
  .action(async (worktreeId, opts) => {
    try {
      const result = await mergeWorktree(worktreeId, {
        strategy: opts.strategy as "merge" | "fast-forward" | "rebase",
      });

      if (opts.json) {
        process.stdout.write(JSON.stringify(result) + "\n");
      } else if (result.success) {
        process.stdout.write(green(`Merged successfully (${result.commits_merged} commits)\n`));
      } else {
        process.stdout.write(red("Merge failed — conflicts in:\n"));
        for (const f of result.conflicts) {
          process.stdout.write(`  ${f}\n`);
        }
        process.exitCode = 1;
      }
    } catch (err) {
      process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    }
  });

worktreeCommand
  .command("clean")
  .description("Remove a worktree from disk")
  .argument("[worktree-id]", "Worktree ID to clean")
  .option("--stale", "Clean all stale worktrees")
  .option("--all", "Skip per-worktree confirmation (with --stale)")
  .option("--dry-run", "Preview what would be cleaned")
  .option("--force", "Remove even if dirty or not merged")
  .option("--json", "Raw JSON output")
  .action(async (worktreeId, opts) => {
    try {
      if (opts.stale) {
        const stale = await detectStaleWorktrees();
        if (stale.length === 0) {
          process.stdout.write("No stale worktrees found.\n");
          return;
        }

        if (opts.dryRun) {
          process.stdout.write(`Would clean ${stale.length} stale worktree(s):\n`);
          for (const wt of stale) {
            process.stdout.write(`  ${wt.branch} (${formatProjectName(wt.project)}) — ${wt.path}\n`);
          }
          return;
        }

        for (const wt of stale) {
          try {
            await cleanupWorktree(wt.id, { force: opts.force });
            process.stdout.write(green(`Cleaned: ${wt.branch}\n`));
          } catch (err) {
            process.stderr.write(red(`Failed: ${wt.branch} — ${err instanceof Error ? err.message : String(err)}\n`));
          }
        }
      } else if (worktreeId) {
        await cleanupWorktree(worktreeId, { force: opts.force });
        process.stdout.write(green("Worktree cleaned.\n"));
      } else {
        process.stderr.write("Provide a worktree ID or use --stale.\n");
        process.exitCode = 1;
      }
    } catch (err) {
      process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 1;
    }
  });
