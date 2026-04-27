import { Command } from "commander";
import { join } from "node:path";
import { homedir } from "node:os";
import { readFile, writeFile, unlink } from "node:fs/promises";

function getPidFilePath(): string {
  return join(homedir(), ".nexus", "dashboard.pid");
}

async function readPidFile(): Promise<number | null> {
  try {
    const content = await readFile(getPidFilePath(), "utf-8");
    const pid = parseInt(content.trim(), 10);
    return Number.isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export const dashboardCommand = new Command("dashboard")
  .description("Start or manage the Nexus Dashboard")
  .option("--port <number>", "Override port (default: 3000)")
  .option("--no-open", "Don't open browser on start")
  .option("--background", "Run as background daemon")
  .action(async (opts) => {
    const existingPid = await readPidFile();
    if (existingPid !== null && isProcessRunning(existingPid)) {
      process.stdout.write(`Dashboard is already running (PID ${existingPid})\n`);
      return;
    }

    if (opts.background) {
      const { spawn } = await import("node:child_process");
      const { mkdir } = await import("node:fs/promises");
      await mkdir(join(homedir(), ".nexus"), { recursive: true });

      const child = spawn(
        process.execPath,
        [
          "--import", "tsx",
          join(import.meta.dirname!, "dashboard-start.js"),
          ...(opts.port ? ["--port", String(opts.port)] : []),
          ...(opts.open === false ? ["--no-open"] : []),
        ],
        {
          detached: true,
          stdio: "ignore",
        },
      );

      child.unref();
      if (child.pid) {
        await writeFile(getPidFilePath(), String(child.pid), "utf-8");
        process.stdout.write(`Dashboard started in background (PID ${child.pid})\n`);
      }
      return;
    }

    const { startServer } = await import("@nexus/dashboard");
    const server = await startServer({
      port: opts.port ? parseInt(opts.port, 10) : undefined,
      open: opts.open !== false,
    });

    process.on("SIGINT", () => {
      server.close();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      server.close();
      process.exit(0);
    });
  });

dashboardCommand
  .command("stop")
  .description("Stop the running Dashboard")
  .action(async () => {
    const pid = await readPidFile();
    if (pid === null) {
      process.stdout.write("No Dashboard PID file found\n");
      return;
    }

    if (!isProcessRunning(pid)) {
      process.stdout.write(`Dashboard process ${pid} is not running, cleaning up PID file\n`);
      await unlink(getPidFilePath()).catch(() => {});
      return;
    }

    try {
      process.kill(pid, "SIGTERM");
      process.stdout.write(`Dashboard stopped (PID ${pid})\n`);
    } catch (err) {
      process.stderr.write(`Failed to stop Dashboard: ${err instanceof Error ? err.message : String(err)}\n`);
    }
    await unlink(getPidFilePath()).catch(() => {});
  });

dashboardCommand
  .command("status")
  .description("Show Dashboard status")
  .action(async () => {
    const pid = await readPidFile();
    if (pid === null) {
      process.stdout.write("Dashboard is not running\n");
      return;
    }

    if (isProcessRunning(pid)) {
      process.stdout.write(`Dashboard is running (PID ${pid})\n`);
    } else {
      process.stdout.write("Dashboard is not running (stale PID file)\n");
      await unlink(getPidFilePath()).catch(() => {});
    }
  });
