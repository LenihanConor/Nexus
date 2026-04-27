import { Hono } from "hono";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { DataCache } from "./data.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getPublicDir(): string {
  return join(__dirname, "..", "public");
}

export function createApp(cache: DataCache): Hono {
  const app = new Hono();

  app.get("/api/data", async (c) => {
    const project = c.req.query("project") || undefined;
    const eventsFrom = c.req.query("eventsFrom") || undefined;
    const eventsTo = c.req.query("eventsTo") || undefined;

    if (eventsFrom || eventsTo) {
      const data = await cache.getDataWithDateRange({ project, eventsFrom, eventsTo });
      return c.json(data);
    }

    return c.json(cache.getData({ project }));
  });

  app.get("/api/summary", (c) => {
    const project = c.req.query("project") || undefined;
    return c.json(cache.getSummary(project));
  });

  app.get("/assets/*", async (c) => {
    const filePath = join(getPublicDir(), c.req.path);
    try {
      const content = await readFile(filePath);
      const ext = filePath.split(".").pop() ?? "";
      const types: Record<string, string> = {
        js: "application/javascript",
        css: "text/css",
        html: "text/html",
        json: "application/json",
        svg: "image/svg+xml",
        png: "image/png",
      };
      return c.body(content, { headers: { "Content-Type": types[ext] ?? "application/octet-stream" } });
    } catch {
      return c.notFound();
    }
  });

  app.get("*", async (c) => {
    const indexPath = join(getPublicDir(), "index.html");
    try {
      const html = await readFile(indexPath, "utf-8");
      return c.html(html);
    } catch {
      return c.text("Dashboard not built. Run: pnpm --filter @nexus/dashboard build:client", 500);
    }
  });

  return app;
}
