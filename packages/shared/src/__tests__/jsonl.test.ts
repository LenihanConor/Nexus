import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { serializeJsonlLine, parseJsonlLine, readJsonlFile } from "../jsonl.js";

describe("serializeJsonlLine", () => {
  it("serializes an object to a single-line JSON string", () => {
    const result = serializeJsonlLine({ name: "test", count: 42 });
    expect(result).toBe('{"name":"test","count":42}');
    expect(result).not.toContain("\n");
  });

  it("handles nested objects", () => {
    const result = serializeJsonlLine({ a: { b: { c: 1 } } });
    expect(JSON.parse(result)).toEqual({ a: { b: { c: 1 } } });
  });

  it("handles null values", () => {
    const result = serializeJsonlLine({ a: null });
    expect(result).toBe('{"a":null}');
  });
});

describe("parseJsonlLine", () => {
  it("parses a valid JSON line", () => {
    const result = parseJsonlLine<{ name: string }>('{"name":"test"}');
    expect(result).toEqual({ name: "test" });
  });

  it("returns null for empty lines", () => {
    expect(parseJsonlLine("")).toBeNull();
    expect(parseJsonlLine("   ")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseJsonlLine("{broken")).toBeNull();
    expect(parseJsonlLine("not json at all")).toBeNull();
  });

  it("trims whitespace before parsing", () => {
    const result = parseJsonlLine('  {"name":"test"}  ');
    expect(result).toEqual({ name: "test" });
  });
});

describe("readJsonlFile", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `nexus-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("reads and parses all valid lines from a file", async () => {
    const filePath = join(tempDir, "test.jsonl");
    writeFileSync(
      filePath,
      '{"id":1}\n{"id":2}\n{"id":3}\n',
      "utf-8",
    );

    const results: unknown[] = [];
    for await (const item of readJsonlFile(filePath)) {
      results.push(item);
    }

    expect(results).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it("skips malformed lines", async () => {
    const filePath = join(tempDir, "test.jsonl");
    writeFileSync(
      filePath,
      '{"id":1}\nBAD LINE\n{"id":3}\n',
      "utf-8",
    );

    const results: unknown[] = [];
    for await (const item of readJsonlFile(filePath)) {
      results.push(item);
    }

    expect(results).toEqual([{ id: 1 }, { id: 3 }]);
  });

  it("skips empty lines", async () => {
    const filePath = join(tempDir, "test.jsonl");
    writeFileSync(
      filePath,
      '{"id":1}\n\n\n{"id":2}\n',
      "utf-8",
    );

    const results: unknown[] = [];
    for await (const item of readJsonlFile(filePath)) {
      results.push(item);
    }

    expect(results).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("handles an empty file", async () => {
    const filePath = join(tempDir, "empty.jsonl");
    writeFileSync(filePath, "", "utf-8");

    const results: unknown[] = [];
    for await (const item of readJsonlFile(filePath)) {
      results.push(item);
    }

    expect(results).toEqual([]);
  });
});
