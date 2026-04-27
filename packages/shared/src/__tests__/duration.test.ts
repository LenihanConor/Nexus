import { describe, it, expect } from "vitest";
import { formatDuration } from "../duration.js";

describe("formatDuration", () => {
  it("formats milliseconds", () => {
    expect(formatDuration(0)).toBe("0ms");
    expect(formatDuration(500)).toBe("500ms");
    expect(formatDuration(999)).toBe("999ms");
  });

  it("formats seconds", () => {
    expect(formatDuration(1000)).toBe("1s");
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(59_000)).toBe("59s");
  });

  it("formats minutes", () => {
    expect(formatDuration(60_000)).toBe("1m");
    expect(formatDuration(120_000)).toBe("2m");
    expect(formatDuration(3_540_000)).toBe("59m");
  });

  it("formats hours with remaining minutes", () => {
    expect(formatDuration(3_600_000)).toBe("1h");
    expect(formatDuration(5_400_000)).toBe("1h 30m");
    expect(formatDuration(7_200_000)).toBe("2h");
    expect(formatDuration(8_100_000)).toBe("2h 15m");
  });

  it("formats days with remaining hours", () => {
    expect(formatDuration(86_400_000)).toBe("1d");
    expect(formatDuration(90_000_000)).toBe("1d 1h");
    expect(formatDuration(172_800_000)).toBe("2d");
    expect(formatDuration(183_600_000)).toBe("2d 3h");
  });

  it("drops sub-units when they are zero", () => {
    expect(formatDuration(3_600_000)).toBe("1h");
    expect(formatDuration(86_400_000)).toBe("1d");
  });
});
