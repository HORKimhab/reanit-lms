import { describe, expect, it } from "vitest";

import { lessonUnlocksAt } from "./drip";

const ENROLLED = new Date("2026-10-01T09:30:00Z");

describe("lessonUnlocksAt", () => {
  it("opens a lesson without drip settings at once", () => {
    expect(lessonUnlocksAt({ unlockAfterDays: null, unlockAt: null }, ENROLLED)).toBeNull();
  });

  it("opens a lesson whole days after the student enrolled", () => {
    expect(lessonUnlocksAt({ unlockAfterDays: 7, unlockAt: null }, ENROLLED)).toEqual(new Date("2026-10-08T09:30:00Z"));
  });

  it("opens a dated lesson on its date for every student", () => {
    expect(lessonUnlocksAt({ unlockAfterDays: null, unlockAt: "2026-12-01T00:00:00Z" }, ENROLLED)).toEqual(new Date("2026-12-01T00:00:00Z"));
  });
});
