import type { LessonUnlock } from "@reanit/core/learning";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import { LessonSchedule } from "./lesson-schedule";

const OPEN: LessonUnlock = { unlockAfterDays: null, unlockAt: null };

/**
 * Renders the schedule of a lesson called "Week 2".
 *
 * @param unlock - Its drip settings.
 * @returns The user-event instance and the change spy.
 */
async function setup(unlock: LessonUnlock = OPEN) {
  const user = userEvent.setup();
  const onChange = vi.fn<(unlock: LessonUnlock) => void>();
  renderWithIntl(<LessonSchedule lessonTitle="Week 2" unlock={unlock} onChange={onChange} />);
  await screen.findByRole("combobox", { name: "When Week 2 opens" });
  return { user, onChange };
}

describe("LessonSchedule", () => {
  it("opens a lesson a week after enrolling when that schedule is picked", async () => {
    const { user, onChange } = await setup();

    await user.selectOptions(screen.getByRole("combobox", { name: "When Week 2 opens" }), "Opens days after enrolling");

    expect(onChange).toHaveBeenCalledWith({ unlockAfterDays: 7, unlockAt: null });
  });

  it("changes the number of days", async () => {
    const { onChange } = await setup({ unlockAfterDays: 7, unlockAt: null });

    // The parent owns the value, so set it in one change as the browser's number field does.
    fireEvent.change(screen.getByRole("spinbutton", { name: "Days after enrolling, for Week 2" }), { target: { value: "3" } });

    expect(onChange).toHaveBeenLastCalledWith({ unlockAfterDays: 3, unlockAt: null });
  });

  it("shows a dated lesson's day and moves it to another", async () => {
    const { onChange } = await setup({ unlockAfterDays: null, unlockAt: new Date(2026, 11, 1).toISOString() });

    const date = screen.getByLabelText("Opening date of Week 2");
    expect(date).toHaveValue("2026-12-01");
    fireEvent.change(date, { target: { value: "2026-12-15" } });

    expect(onChange).toHaveBeenLastCalledWith({ unlockAfterDays: null, unlockAt: new Date(2026, 11, 15).toISOString() });
  });

  it("opens a lesson at once again", async () => {
    const { user, onChange } = await setup({ unlockAfterDays: 7, unlockAt: null });

    await user.selectOptions(screen.getByRole("combobox", { name: "When Week 2 opens" }), "Opens at once");

    expect(onChange).toHaveBeenCalledWith(OPEN);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
