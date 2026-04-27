import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { DataCache, setNexusDir } from "./data.js";

export interface ServerOptions {
  port?: number;
  pollInterval?: number;
  open?: boolean;
  nexusDir?: string;
}

async function findAvailablePort(startPort: number): Promise<number> {
  const { createServer } = await import("node:net");
  for (let port = startPort; port <= startPort + 5; port++) {
    const available = await new Promise<boolean>((resolve) => {
      const server = createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => {
        server.close(() => resolve(true));
      });
      server.listen(port, "127.0.0.1");
    });
    if (available) return port;
  }
  throw new Error(`No available port found in range ${startPort}-${startPort + 5}`);
}

export async function startServer(opts: ServerOptions = {}): Promise<{
  port: number;
  close: () => void;
}> {
  if (opts.nexusDir) {
    setNexusDir(opts.nexusDir);
  }

  const cache = new DataCache();
  await cache.loadInitial();
  cache.startPolling(opts.pollInterval ?? 5000);

  const app = createApp(cache);
  const port = await findAvailablePort(opts.port ?? 3000);

  const server = serve({
    fetch: app.fetch,
    port,
    hostname: "127.0.0.1",
  });

  const url = `http://localhost:${port}`;
  process.stdout.write(`Nexus Dashboard running at ${url}\n`);

  if (opts.open !== false) {
    openBrowser(url);
  }

  return {
    port,
    close: () => {
      cache.stopPolling();
      server.close();
    },
  };
}

async function openBrowser(url: string): Promise<void> {
  const { exec } = await import("node:child_process");
  const cmd =
    process.platform === "win32" ? `start "" "${url}"`
    : process.platform === "darwin" ? `open "${url}"`
    : `xdg-open "${url}"`;

  exec(cmd, (err) => {
    if (err) {
      process.stderr.write(`Could not open browser: ${err.message}\n`);
    }
  });
}
