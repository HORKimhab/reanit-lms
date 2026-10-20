import { describe, expect, it } from "vitest";

import { isoDay, presetRange } from "./range-presets";

describe("presetRange", () => {
  it.each([
    [7, "2026-10-14"],
    [30, "2026-09-21"],
    [90, "2026-07-23"],
  ])("covers %i days up to today, today included", (days, from) => {
    expect(presetRange(days, new Date("2026-10-20T23:59:00Z"))).toEqual({ from, to: "2026-10-20" });
  });
});

describe("isoDay", () => {
  it("names the UTC day, whatever the time", () => {
    expect(isoDay(new Date("2026-01-05T00:00:00Z"))).toBe("2026-01-05");
    expect(isoDay(new Date("2026-01-05T23:59:59Z"))).toBe("2026-01-05");
  });
});
