import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

export function serializeJsonlLine(data: unknown): string {
  return JSON.stringify(data, (_key, value) =>
    value === undefined ? undefined : value,
  );
}

export function parseJsonlLine<T = unknown>(line: string): T | null {
  const trimmed = line.trim();
  if (trimmed === "") return null;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}

export async function* readJsonlFile<T = unknown>(
  filePath: string,
): AsyncIterable<T> {
  const stream = createReadStream(filePath, { encoding: "utf-8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  try {
    for await (const line of rl) {
      const parsed = parseJsonlLine<T>(line);
      if (parsed !== null) {
        yield parsed;
      }
    }
  } finally {
    rl.close();
    stream.destroy();
  }
}
