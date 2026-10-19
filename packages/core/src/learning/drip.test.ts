import { describe, expect, it } from "vitest";

import { lessonUnlocksAt, lockedUntil } from "./drip";

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

describe("lockedUntil", () => {
  it("gives the opening time while it is ahead, and null from that moment", () => {
    const lesson = { unlockAfterDays: 1, unlockAt: null };
    const opens = new Date("2026-10-02T09:30:00Z");

    expect(lockedUntil(lesson, ENROLLED, new Date(opens.getTime() - 1))).toEqual(opens);
    expect(lockedUntil(lesson, ENROLLED, opens)).toBeNull();
  });
});
