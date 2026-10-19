import { describe, expect, it } from "vitest";

import type { Outline } from "@reanit/core/catalog";

import { outlineReducer } from "./outline-reducer";

const OUTLINE: Outline = {
  sections: [
    {
      id: "a",
      title: "Intro",
      lessons: [
        { id: "a1", title: "Welcome", type: "video", durationSeconds: 60 },
        { id: "a2", title: "Setup", type: "text", durationSeconds: 0 },
        { id: "a3", title: "Workbook", type: "pdf", durationSeconds: 0 },
      ],
    },
    { id: "b", title: "Basics", lessons: [] },
    { id: "c", title: "Wrap-up", lessons: [] },
  ],
};

/**
 * Lists section ids in order.
 *
 * @param outline - The outline.
 * @returns The section ids.
 */
function sectionIds(outline: Outline) {
  return outline.sections.map((s) => s.id);
}

/**
 * Lists the first section's lesson ids in order.
 *
 * @param outline - The outline.
 * @returns The lesson ids.
 */
function lessonIds(outline: Outline) {
  return outline.sections[0]?.lessons.map((l) => l.id);
}

describe("outlineReducer", () => {
  it("adds an empty section at the end", () => {
    const next = outlineReducer(OUTLINE, { type: "addSection", id: "d", title: "New" });
    expect(next.sections.at(-1)).toEqual({ id: "d", title: "New", lessons: [] });
  });

  it("renames only the given section", () => {
    const next = outlineReducer(OUTLINE, { type: "renameSection", sectionId: "b", title: "Core" });
    expect(next.sections.map((s) => s.title)).toEqual(["Intro", "Core", "Wrap-up"]);
  });

  it("removes a section with its lessons", () => {
    expect(sectionIds(outlineReducer(OUTLINE, { type: "removeSection", sectionId: "a" }))).toEqual(["b", "c"]);
  });

  it("moves a dragged section down to where it is dropped", () => {
    expect(sectionIds(outlineReducer(OUTLINE, { type: "moveSection", activeId: "a", overId: "c" }))).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("moves a dragged section up to where it is dropped", () => {
    expect(sectionIds(outlineReducer(OUTLINE, { type: "moveSection", activeId: "c", overId: "a" }))).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("leaves the outline unchanged when a section is dropped outside the list", () => {
    expect(outlineReducer(OUTLINE, { type: "moveSection", activeId: "a", overId: "zzz" })).toEqual(OUTLINE);
  });

  it("adds a text lesson with no running time at the end of the section", () => {
    const next = outlineReducer(OUTLINE, { type: "addLesson", sectionId: "b", id: "b1", title: "New lesson" });
    expect(next.sections[1]?.lessons).toEqual([{ id: "b1", title: "New lesson", type: "text", durationSeconds: 0 }]);
  });

  it("renames only the given lesson", () => {
    const next = outlineReducer(OUTLINE, { type: "renameLesson", sectionId: "a", lessonId: "a2", title: "Install" });
    expect(next.sections[0]?.lessons.map((l) => l.title)).toEqual(["Welcome", "Install", "Workbook"]);
  });

  it("changes a lesson's type, leaving the others alone", () => {
    const next = outlineReducer(OUTLINE, { type: "setLessonType", sectionId: "a", lessonId: "a2", lessonType: "video" });
    expect(next.sections[0]?.lessons.map((l) => l.type)).toEqual(["video", "video", "pdf"]);
    expect(OUTLINE.sections[0]?.lessons[1]?.type).toBe("text");
  });

  it("removes a lesson", () => {
    expect(lessonIds(outlineReducer(OUTLINE, { type: "removeLesson", sectionId: "a", lessonId: "a1" }))).toEqual([
      "a2",
      "a3",
    ]);
  });

  it("moves a dragged lesson to where it is dropped inside its section", () => {
    const next = outlineReducer(OUTLINE, { type: "moveLesson", sectionId: "a", activeId: "a3", overId: "a1" });
    expect(lessonIds(next)).toEqual(["a3", "a1", "a2"]);
  });

  it("does not mutate the outline it was given", () => {
    const before = structuredClone(OUTLINE);
    outlineReducer(OUTLINE, { type: "moveLesson", sectionId: "a", activeId: "a1", overId: "a3" });
    outlineReducer(OUTLINE, { type: "renameSection", sectionId: "a", title: "Changed" });
    expect(OUTLINE).toEqual(before);
  });
});
