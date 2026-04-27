import { Command } from "commander";
import type { NexusEvent } from "@nexus/shared";
import { summarizeEvent } from "@nexus/shared";
import { query, tail } from "../audit/index.js";
import type { EventQuery } from "../audit/index.js";

const isTTY = process.stdout.isTTY ?? false;

function color(code: number, text: string): string {
  if (!isTTY) return text;
  return `\x1b[${code}m${text}\x1b[0m`;
}

function dim(text: string): string {
  return color(2, text);
}

function cyan(text: string): string {
  return color(36, text);
}

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

function formatProjectName(project: string): string {
  const parts = project.split("/");
  return parts[parts.length - 1] ?? project;
}

function formatEventTable(events: NexusEvent[]): string {
  if (events.length === 0) return "No events found.\n";

  const header = `${dim("TIME".padEnd(10))}${dim("TYPE".padEnd(28))}${dim("PROJECT".padEnd(16))}${dim("SUMMARY")}`;
  const rows = events.map((e) => {
    const time = formatTime(e.timestamp).padEnd(10);
    const type = cyan(e.event_type.padEnd(28));
    const project = formatProjectName(e.project).padEnd(16);
    const summary = summarizeEvent(e);
    return `${time}${type}${project}${summary}`;
  });

  return [header, ...rows].join("\n") + "\n";
}

function parseRelativeDate(input: string): string {
  const lower = input.toLowerCase();
  const now = new Date();

  if (lower === "today") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  }
  if (lower === "yesterday") {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    return d.toISOString();
  }

  const daysMatch = lower.match(/^(\d+)d$/);
  if (daysMatch) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - Number(daysMatch[1])));
    return d.toISOString();
  }

  return input;
}

function buildFilters(opts: Record<string, string | undefined>, defaultLimit: number): EventQuery {
  const filters: EventQuery = { limit: defaultLimit };
  if (opts.project) filters.project = opts.project;
  if (opts.type) filters.event_type = opts.type;
  if (opts.session) filters.session_id = opts.session;
  if (opts.from) filters.from = parseRelativeDate(opts.from);
  if (opts.to) filters.to = parseRelativeDate(opts.to);
  if (opts.limit) filters.limit = Number(opts.limit);
  return filters;
}

export const eventsCommand = new Command("events")
  .description("Inspect the audit trail");

eventsCommand
  .command("list")
  .description("Show recent events")
  .option("--limit <n>", "Number of events", "20")
  .option("--project <path>", "Filter by project")
  .option("--type <type>", "Filter by event type")
  .option("--session <id>", "Filter by session ID")
  .option("--from <date>", "Start date (ISO 8601, 'today', 'yesterday', '7d')")
  .option("--to <date>", "End date")
  .option("--json", "Raw JSON output")
  .action(async (opts) => {
    const filters = buildFilters(opts, Number(opts.limit));
    const events = await query(filters);

    if (opts.json) {
      for (const e of events) {
        process.stdout.write(JSON.stringify(e) + "\n");
      }
    } else {
      process.stdout.write(formatEventTable(events));
    }
  });

eventsCommand
  .command("search")
  .description("Search events with filters")
  .option("--limit <n>", "Number of events", "100")
  .option("--project <path>", "Filter by project")
  .option("--type <type>", "Filter by event type")
  .option("--session <id>", "Filter by session ID")
  .option("--from <date>", "Start date")
  .option("--to <date>", "End date")
  .option("--json", "Raw JSON output")
  .action(async (opts) => {
    const filters = buildFilters(opts, Number(opts.limit));
    const events = await query(filters);

    if (opts.json) {
      for (const e of events) {
        process.stdout.write(JSON.stringify(e) + "\n");
      }
    } else {
      process.stdout.write(formatEventTable(events));
    }
  });

eventsCommand
  .command("tail")
  .description("Live stream of new events")
  .option("--project <path>", "Filter by project")
  .option("--type <type>", "Filter by event type")
  .option("--session <id>", "Filter by session ID")
  .option("--json", "Raw JSON output")
  .action(async (opts) => {
    const filters = buildFilters(opts, 1000);

    process.stdout.write(dim("Watching for events... (Ctrl+C to stop)\n"));

    for await (const event of tail(filters)) {
      if (opts.json) {
        process.stdout.write(JSON.stringify(event) + "\n");
      } else {
        const time = formatTime(event.timestamp).padEnd(10);
        const type = cyan(event.event_type.padEnd(28));
        const project = formatProjectName(event.project).padEnd(16);
        const summary = summarizeEvent(event);
        process.stdout.write(`${time}${type}${project}${summary}\n`);
      }
    }
  });
