#!/usr/bin/env node
import { Command } from "commander";
import { eventsCommand } from "./events.js";
import { worktreeCommand } from "./worktree.js";
import { sessionCommand } from "./session.js";
import { dashboardCommand } from "./dashboard.js";
import { runCommand } from "./run.js";
import { adapterCommand } from "./adapter.js";
import { initCommand } from "./init.js";
import { budgetCommand } from "./budget.js";
import { approvalCommand, approveCommand, rejectCommand } from "./approval.js";

const program = new Command();

program
  .name("nexus")
  .description("Local-first AI development orchestrator")
  .version("0.1.0");

program.addCommand(eventsCommand);
program.addCommand(worktreeCommand);
program.addCommand(sessionCommand);
program.addCommand(dashboardCommand);
program.addCommand(runCommand);
program.addCommand(adapterCommand);
program.addCommand(initCommand);
program.addCommand(budgetCommand);
program.addCommand(approvalCommand);
program.addCommand(approveCommand);
program.addCommand(rejectCommand);

program.parse();
