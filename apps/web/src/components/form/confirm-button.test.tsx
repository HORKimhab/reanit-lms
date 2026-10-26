import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import { ConfirmButton, type ConfirmLabels } from "./confirm-button";

const LABELS: ConfirmLabels = {
  trigger: "Delete course",
  warning: "This deletes the course. It cannot be undone.",
  confirm: "Delete for good",
  pending: "Deleting…",
  cancel: "Cancel",
};

/**
 * Renders the button with an action spy.
 *
 * @returns The user-event instance and the spy.
 */
async function setup() {
  const user = userEvent.setup();
  const action = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  renderWithIntl(<ConfirmButton action={action} labels={LABELS} />);
  await screen.findByRole("button", { name: "Delete course" });
  return { user, action };
}

describe("ConfirmButton", () => {
  it("asks for confirmation before running the action", async () => {
    const { user, action } = await setup();

    await user.click(screen.getByRole("button", { name: "Delete course" }));

    expect(screen.getByRole("alert")).toHaveTextContent("It cannot be undone.");
    expect(action).not.toHaveBeenCalled();
  });

  it("runs the action once confirmed", async () => {
    const { user, action } = await setup();

    await user.click(screen.getByRole("button", { name: "Delete course" }));
    await user.click(screen.getByRole("button", { name: "Delete for good" }));

    expect(action).toHaveBeenCalledOnce();
  });

  it("goes back without running the action when cancelled", async () => {
    const { user, action } = await setup();

    await user.click(screen.getByRole("button", { name: "Delete course" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete course" })).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });
});
