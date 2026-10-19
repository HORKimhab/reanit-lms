import { arrayMove } from "@dnd-kit/sortable";
import type { Outline } from "@reanit/core/catalog";

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
        { id: action.id, title: action.title, type: NEW_LESSON_TYPE, durationSeconds: 0 },
      ]);
    case "renameLesson":
      return updateLessons(outline, action.sectionId, (lessons) =>
        lessons.map((l) => (l.id === action.lessonId ? { ...l, title: action.title } : l)),
      );
    case "removeLesson":
      return updateLessons(outline, action.sectionId, (lessons) => lessons.filter((l) => l.id !== action.lessonId));
    case "moveLesson":
      return updateLessons(outline, action.sectionId, (lessons) => moveById(lessons, action.activeId, action.overId));
  }
}
