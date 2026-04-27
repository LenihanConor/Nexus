import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { startServer } from "../server.js";
import { setNexusDir } from "../data.js";

let tempDir: string;

beforeEach(() => {
  tempDir = join(tmpdir(), `nexus-server-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(tempDir, "sessions"), { recursive: true });
  mkdirSync(join(tempDir, "worktrees"), { recursive: true });
  mkdirSync(join(tempDir, "events"), { recursive: true });
  setNexusDir(tempDir);
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function occupyPort(port: number): Promise<{ close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(port, "127.0.0.1", () => {
      resolve({
        close: () => new Promise<void>((res) => server.close(() => res())),
      });
    });
  });
}

describe("startServer", () => {
  it("starts on the requested port", async () => {
    const server = await startServer({
      port: 39100,
      open: false,
      nexusDir: tempDir,
    });
    try {
      expect(server.port).toBe(39100);
      const res = await fetch(`http://localhost:${server.port}/api/summary`);
      expect(res.status).toBe(200);
    } finally {
      server.close();
    }
  });

  it("falls back to next port when requested port is occupied", async () => {
    const blocker = await occupyPort(39200);
    try {
      const server = await startServer({
        port: 39200,
        open: false,
        nexusDir: tempDir,
      });
      try {
        expect(server.port).toBe(39201);
        const res = await fetch(`http://localhost:${server.port}/api/summary`);
        expect(res.status).toBe(200);
      } finally {
        server.close();
      }
    } finally {
      await blocker.close();
    }
  });

  it("serves API data with empty nexus directory", async () => {
    const server = await startServer({
      port: 39300,
      open: false,
      nexusDir: tempDir,
    });
    try {
      const res = await fetch(`http://localhost:${server.port}/api/data`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.sessions).toEqual([]);
      expect(body.worktrees).toEqual([]);
      expect(body.events).toEqual([]);
      expect(body.projects).toEqual([]);
    } finally {
      server.close();
    }
  });

  it("close() stops the server", async () => {
    const server = await startServer({
      port: 39400,
      open: false,
      nexusDir: tempDir,
    });
    const port = server.port;
    server.close();

    // Give server a moment to release the port
    await new Promise((r) => setTimeout(r, 100));

    try {
      await fetch(`http://localhost:${port}/api/summary`);
      expect.fail("Should have thrown");
    } catch (err) {
      expect((err as Error).message).toMatch(/fetch failed|ECONNREFUSED|network/i);
    }
  });
});
