import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import { DeleteCourseButton } from "./delete-course-button";

/**
 * Renders the button with a delete spy.
 *
 * @returns The user-event instance and the spy.
 */
async function setup() {
  const user = userEvent.setup();
  const action = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  renderWithIntl(<DeleteCourseButton action={action} />);
  await screen.findByRole("button", { name: "Delete course" });
  return { user, action };
}

describe("DeleteCourseButton", () => {
  it("asks for confirmation before deleting", async () => {
    const { user, action } = await setup();

    await user.click(screen.getByRole("button", { name: "Delete course" }));

    expect(screen.getByRole("alert")).toHaveTextContent("It cannot be undone.");
    expect(action).not.toHaveBeenCalled();
  });

  it("deletes once confirmed", async () => {
    const { user, action } = await setup();

    await user.click(screen.getByRole("button", { name: "Delete course" }));
    await user.click(screen.getByRole("button", { name: "Delete for good" }));

    expect(action).toHaveBeenCalledOnce();
  });

  it("goes back without deleting when cancelled", async () => {
    const { user, action } = await setup();

    await user.click(screen.getByRole("button", { name: "Delete course" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete course" })).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });
});
