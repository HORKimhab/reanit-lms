import { arrayMove } from "@dnd-kit/sortable";
import type { LessonType, Outline } from "@reanit/core/catalog";
import type { LessonUnlock } from "@reanit/core/learning";

/** A section and its lessons, in order, as the builder edits it. */
export type OutlineSection = Outline["sections"][number];
/** A lesson as the builder edits it. */
type OutlineLesson = OutlineSection["lessons"][number];

/** An edit the course builder makes to an outline. New items carry an id made by the caller. */
export type OutlineAction =
  | { type: "addSection"; id: string; title: string }
  | { type: "renameSection"; sectionId: string; title: string }
  | { type: "removeSection"; sectionId: string }
  /** Drops the dragged section `activeId` where section `overId` is. */
  | { type: "moveSection"; activeId: string; overId: string }
  | { type: "addLesson"; sectionId: string; id: string; title: string }
  | { type: "renameLesson"; sectionId: string; lessonId: string; title: string }
  | { type: "setLessonType"; sectionId: string; lessonId: string; lessonType: LessonType }
  /** Sets when a drip lesson opens: some days after enrolling, on a date, or (both null) at once. */
  | { type: "setLessonUnlock"; sectionId: string; lessonId: string; unlock: LessonUnlock }
  | { type: "removeLesson"; sectionId: string; lessonId: string }
  /** Drops the dragged lesson `activeId` where lesson `overId` is, inside one section. */
  | { type: "moveLesson"; sectionId: string; activeId: string; overId: string };

/** Lessons added in the builder start as text; WEB-13 adds video upload. */
const NEW_LESSON_TYPE = "text";

/**
 * Moves the item with id `activeId` to the position of the item with id `overId`.
 *
 * @param items - Items with ids, in order.
 * @param activeId - Id of the item being moved.
 * @param overId - Id of the item it is dropped on.
 * @returns The reordered items, or the same array when either id is missing.
 */
function moveById<T extends { id: string }>(items: T[], activeId: string, overId: string) {
  const from = items.findIndex((item) => item.id === activeId);
  const to = items.findIndex((item) => item.id === overId);
  return from === -1 || to === -1 ? items : arrayMove(items, from, to);
}

/**
 * Applies a change to one section's lessons.
 *
 * @param outline - The current outline.
 * @param sectionId - The section to change.
 * @param change - Builds the section's new lessons from its current ones.
 * @returns The outline with that section's lessons replaced.
 */
function updateLessons(outline: Outline, sectionId: string, change: (lessons: OutlineLesson[]) => OutlineLesson[]) {
  return updateSection(outline, sectionId, (section) => ({ ...section, lessons: change(section.lessons) }));
}

/**
 * Applies a change to one section.
 *
 * @param outline - The current outline.
 * @param sectionId - The section to change.
 * @param change - Builds the new section from the current one.
 * @returns The outline with that section replaced; unchanged when no section has that id.
 */
function updateSection(outline: Outline, sectionId: string, change: (section: OutlineSection) => OutlineSection) {
  return { sections: outline.sections.map((s) => (s.id === sectionId ? change(s) : s)) };
}

/**
 * Changes fields of one lesson.
 *
 * @param outline - The current outline.
 * @param target - Where the lesson is.
 * @param target.sectionId - Its section.
 * @param target.lessonId - The lesson.
 * @param changes - The new field values.
 * @returns The new outline.
 */
function updateLesson(
  outline: Outline,
  { sectionId, lessonId }: { sectionId: string; lessonId: string },
  changes: Partial<OutlineLesson>,
) {
  return updateLessons(outline, sectionId, (lessons) => lessons.map((l) => (l.id === lessonId ? { ...l, ...changes } : l)));
}

/**
 * Applies one builder edit to an outline without mutating it.
 *
 * @param outline - The current outline.
 * @param action - The edit to apply.
 * @returns The new outline.
 */
export function outlineReducer(outline: Outline, action: OutlineAction): Outline {
  switch (action.type) {
    case "addSection":
      return { sections: [...outline.sections, { id: action.id, title: action.title, lessons: [] }] };
    case "renameSection":
      return updateSection(outline, action.sectionId, (s) => ({ ...s, title: action.title }));
    case "removeSection":
      return { sections: outline.sections.filter((s) => s.id !== action.sectionId) };
    case "moveSection":
      return { sections: moveById(outline.sections, action.activeId, action.overId) };
    case "addLesson":
      return updateLessons(outline, action.sectionId, (lessons) => [
        ...lessons,
        { id: action.id, title: action.title, type: NEW_LESSON_TYPE, durationSeconds: 0, unlockAfterDays: null, unlockAt: null },
      ]);
    case "renameLesson":
      return updateLesson(outline, action, { title: action.title });
    case "setLessonType":
      return updateLesson(outline, action, { type: action.lessonType });
    case "setLessonUnlock":
      return updateLesson(outline, action, action.unlock);
    case "removeLesson":
      return updateLessons(outline, action.sectionId, (lessons) => lessons.filter((l) => l.id !== action.lessonId));
    case "moveLesson":
      return updateLessons(outline, action.sectionId, (lessons) => moveById(lessons, action.activeId, action.overId));
  }
}
