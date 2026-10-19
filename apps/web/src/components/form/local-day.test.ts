import { describe, expect, it } from "vitest";

import { END_OF_DAY, isoToLocalDay, localDayToIso } from "./local-day";

describe("localDayToIso", () => {
  it("gives the start of the day in the browser's time zone by default", () => {
    expect(localDayToIso("2026-12-01")).toBe(new Date(2026, 11, 1).toISOString());
  });

  it("gives the day's last millisecond when asked", () => {
    expect(localDayToIso("2026-12-31", END_OF_DAY)).toBe(new Date(2026, 11, 31, 23, 59, 59, 999).toISOString());
  });

  it.each([[""], ["tomorrow"]])("refuses %j", (day) => {
    expect(localDayToIso(day)).toBeNull();
  });
});

describe("isoToLocalDay", () => {
  it("shows a moment as its day in the browser's time zone, padded", () => {
    expect(isoToLocalDay(new Date(2026, 0, 5, 12).toISOString())).toBe("2026-01-05");
  });

  it("reads back the day localDayToIso made", () => {
    expect(isoToLocalDay(localDayToIso("2026-03-09") ?? "")).toBe("2026-03-09");
  });
});
