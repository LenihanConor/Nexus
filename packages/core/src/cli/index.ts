#!/usr/bin/env node
import { Command } from "commander";
import { eventsCommand } from "./events.js";
import { worktreeCommand } from "./worktree.js";
import { sessionCommand } from "./session.js";
import { dashboardCommand } from "./dashboard.js";

const program = new Command();

program
  .name("nexus")
  .description("Local-first AI development orchestrator")
  .version("0.1.0");

program.addCommand(eventsCommand);
program.addCommand(worktreeCommand);
program.addCommand(sessionCommand);
program.addCommand(dashboardCommand);

program.parse();
