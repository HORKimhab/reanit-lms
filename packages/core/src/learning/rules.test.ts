import { describe, expect, it } from "vitest";

import { playerLessons, progressSchema, summarizeProgress } from "./rules";

const NOW = new Date("2026-10-10T00:00:00Z");
const COURSE = {
  enrolledAt: new Date("2026-10-01T00:00:00Z"),
  sections: [
    {
      id: "s1",
      title: "Start",
      lessons: [
        { id: "l1", title: "Welcome", type: "video" as const, durationSeconds: 60, hasMedia: true, unlockAfterDays: null, unlockAt: null },
        { id: "l2", title: "Workbook", type: "pdf" as const, durationSeconds: 0, hasMedia: true, unlockAfterDays: null, unlockAt: null },
      ],
    },
    { id: "s2", title: "Logo", lessons: [{ id: "l3", title: "Sketching", type: "video" as const, durationSeconds: 90, hasMedia: false, unlockAfterDays: null, unlockAt: null }] },
  ],
};

describe("playerLessons", () => {
  it("flattens the outline in order with each lesson's section and progress", () => {
    const lessons = playerLessons(COURSE, [{ lessonId: "l3", positionSeconds: 40, isCompleted: false }], NOW);

    expect(lessons.map(({ id, index, sectionId, sectionTitle, positionSeconds, isCompleted }) => ({ id, index, sectionId, sectionTitle, positionSeconds, isCompleted }))).toEqual([
      { id: "l1", index: 0, sectionId: "s1", sectionTitle: "Start", positionSeconds: 0, isCompleted: false },
      { id: "l2", index: 1, sectionId: "s1", sectionTitle: "Start", positionSeconds: 0, isCompleted: false },
      { id: "l3", index: 2, sectionId: "s2", sectionTitle: "Logo", positionSeconds: 40, isCompleted: false },
    ]);
  });
});

describe("playerLessons drip", () => {
  it("says until when each closed drip lesson stays closed, and nothing for open ones", () => {
    const [section] = COURSE.sections;
    const dripped = {
      ...COURSE,
      sections: [
        {
          ...section!,
          lessons: [
            { ...section!.lessons[0]!, unlockAfterDays: 9 },
            { ...section!.lessons[1]!, unlockAfterDays: 10 },
          ],
        },
      ],
    };

    expect(playerLessons(dripped, [], NOW).map((lesson) => lesson.lockedUntil)).toEqual([null, new Date("2026-10-11T00:00:00Z")]);
  });
});

describe("summarizeProgress", () => {
  it("counts completed lessons and resumes at the first one not completed", () => {
    const summary = summarizeProgress(
      playerLessons(
        COURSE,
        [
          { lessonId: "l1", positionSeconds: 0, isCompleted: true },
          { lessonId: "l3", positionSeconds: 0, isCompleted: true },
        ],
        NOW,
      ),
    );

    expect(summary).toMatchObject({ completed: 2, total: 3, percent: 67 });
    expect(summary.resume?.id).toBe("l2");
  });

  it("resumes at the last lesson when every lesson is completed", () => {
    const done = ["l1", "l2", "l3"].map((lessonId) => ({ lessonId, positionSeconds: 0, isCompleted: true }));

    const summary = summarizeProgress(playerLessons(COURSE, done, NOW));

    expect(summary).toMatchObject({ completed: 3, total: 3, percent: 100 });
    expect(summary.resume?.id).toBe("l3");
  });

  it("has nothing to resume in an empty course", () => {
    expect(summarizeProgress([])).toEqual({ completed: 0, total: 0, percent: 0, resume: undefined });
  });
});

describe("progressSchema", () => {
  it.each([[{ positionSeconds: 30 }], [{ completed: true }], [{ positionSeconds: 0, completed: true }]])("accepts %j", (input) => {
    expect(progressSchema.parse(input)).toEqual(input);
  });

  it.each([
    ["nothing", {}],
    ["a negative position", { positionSeconds: -1 }],
    ["a fractional position", { positionSeconds: 1.5 }],
    ["a position over a day", { positionSeconds: 86_401 }],
    ["un-completing", { completed: false }],
  ])("rejects %s", (_case, input) => {
    expect(progressSchema.safeParse(input).success).toBe(false);
  });
});
