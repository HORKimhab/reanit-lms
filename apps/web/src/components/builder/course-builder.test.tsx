import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Outline } from "@/mocks/outline";
import { renderWithIntl } from "@/test/render";

import { CourseBuilder } from "./course-builder";

const ROW_HEIGHT_PX = 40;
const ROW_WIDTH_PX = 600;

const OUTLINE: Outline = {
  sections: [
    {
      id: "a",
      title: "Intro",
      lessons: [
        { id: "a1", title: "Welcome", type: "video", durationSec: 60 },
        { id: "a2", title: "Setup", type: "text", durationSec: 0 },
      ],
    },
    { id: "b", title: "Basics", lessons: [] },
  ],
};

/** The builder's save function, as a spy. */
type SaveSpy = ReturnType<typeof vi.fn<(outline: Outline) => Promise<void>>>;

/**
 * Builds a save spy that always succeeds.
 *
 * @returns The spy.
 */
function okSave(): SaveSpy {
  return vi.fn<(outline: Outline) => Promise<void>>().mockResolvedValue(undefined);
}

/**
 * Renders the builder with fake timers wired into user-event.
 *
 * @param save - The save function the builder autosaves through.
 * @returns The user-event instance.
 */
function setup(save: SaveSpy = okSave()) {
  renderWithIntl(<CourseBuilder initial={OUTLINE} save={save} />);
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
}

/**
 * Lets the autosave delay pass and the save settle.
 */
async function waitForAutosave() {
  await act(async () => vi.runOnlyPendingTimers());
}

/**
 * Reads the titles of every field with the given label, in page order.
 *
 * @param label - The fields' accessible name.
 * @returns Their current values.
 */
function titles(label: string) {
  return screen.getAllByRole<HTMLInputElement>("textbox", { name: label }).map((input) => input.value);
}

/**
 * Drags an item with the keyboard: space to pick it up, the given keys, space to drop.
 *
 * @param user - The user-event instance.
 * @param handle - Accessible name of the item's drag handle.
 * @param moves - Keys to press while holding the item, in user-event syntax; empty drops it in place.
 */
async function dragWithKeyboard(user: ReturnType<typeof userEvent.setup>, handle: string, moves: string) {
  (await screen.findByRole("button", { name: handle })).focus();
  await user.keyboard(" ");
  if (moves) await user.keyboard(moves);
  await user.keyboard(" ");
  await waitForAutosave();
}

beforeEach(() => {
  // Real time still moves so findBy* polling works; tests jump ahead with runOnlyPendingTimers.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  // jsdom has no layout; give each list row its own slot in document order so drag-and-drop can measure it.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const row = this.closest("li");
    const top = row ? [...document.querySelectorAll("li")].indexOf(row) * ROW_HEIGHT_PX : 0;
    return DOMRect.fromRect({ x: 0, y: top, width: ROW_WIDTH_PX, height: ROW_HEIGHT_PX });
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("CourseBuilder", () => {
  it("shows every section and lesson as an editable title", async () => {
    setup();
    expect(await screen.findAllByRole("textbox", { name: "Section title" })).toHaveLength(2);
    expect(titles("Section title")).toEqual(["Intro", "Basics"]);
    expect(titles("Lesson title")).toEqual(["Welcome", "Setup"]);
    expect(screen.getByText("No lessons in this section yet.")).toBeInTheDocument();
  });

  it("autosaves the outline once typing stops and says the changes are saved", async () => {
    const save = okSave();
    const user = setup(save);
    const lesson = (await screen.findAllByRole("textbox", { name: "Lesson title" }))[1] as HTMLElement;
    await user.type(lesson, " tools");
    expect(save).not.toHaveBeenCalled();
    await waitForAutosave();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.lastCall?.[0].sections[0]?.lessons[1]?.title).toBe("Setup tools");
    expect(screen.getByText("All changes saved")).toHaveAttribute("role", "status");
  });

  it("tells the creator when a save fails", async () => {
    const user = setup(vi.fn<(outline: Outline) => Promise<void>>().mockRejectedValue(new Error("offline")));
    await user.click(await screen.findByRole("button", { name: "Remove lesson Welcome" }));
    await waitForAutosave();
    expect(screen.getByText("Couldn't save. Your next edit will try again.")).toHaveAttribute("role", "status");
  });

  it("adds an untitled section at the end and an untitled lesson to a section", async () => {
    const user = setup();
    await user.click(await screen.findByRole("button", { name: "Add section" }));
    expect(titles("Section title")).toEqual(["Intro", "Basics", "Untitled section"]);
    const basics = screen.getByRole("button", { name: "Move section Basics" }).closest("li") as HTMLElement;
    await user.click(within(basics).getByRole("button", { name: "Add lesson" }));
    expect(within(basics).getByRole<HTMLInputElement>("textbox", { name: "Lesson title" }).value).toBe("Untitled lesson");
  });

  it("removes a lesson and a section", async () => {
    const user = setup();
    await user.click(await screen.findByRole("button", { name: "Remove lesson Welcome" }));
    expect(titles("Lesson title")).toEqual(["Setup"]);
    await user.click(screen.getByRole("button", { name: "Remove section Basics" }));
    expect(titles("Section title")).toEqual(["Intro"]);
  });

  it("moves a section down with the keyboard and announces the drop", async () => {
    await dragWithKeyboard(setup(), "Move section Intro", "{ArrowDown}");
    expect(titles("Section title")).toEqual(["Basics", "Intro"]);
    expect(screen.getByText("Intro was dropped at Basics.")).toBeInTheDocument();
  });

  it("does not save when a section is picked up and dropped where it was", async () => {
    const save = okSave();
    await dragWithKeyboard(setup(save), "Move section Intro", "");
    expect(save).not.toHaveBeenCalled();
  });

  it("moves a lesson within its section with the keyboard", async () => {
    await dragWithKeyboard(setup(), "Move lesson Welcome", "{ArrowDown}");
    expect(titles("Lesson title")).toEqual(["Setup", "Welcome"]);
    expect(titles("Section title")).toEqual(["Intro", "Basics"]);
  });

  it("uses Khmer labels when the locale is km", async () => {
    renderWithIntl(<CourseBuilder initial={OUTLINE} save={okSave()} />, { locale: "km" });
    expect(await screen.findByRole("button", { name: "បន្ថែមផ្នែក" })).toBeInTheDocument();
  });
});
