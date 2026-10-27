import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { SuspendState } from "@/app/[locale]/admin/actions";
import { renderWithIntl } from "@/test/render";

import { SuspensionControl } from "./suspension-control";

/**
 * Renders the control with spies for its actions.
 *
 * @param suspension - The school's suspension, or null.
 * @param answer - What suspending returns.
 * @returns The user-event instance and the spies.
 */
function setup(suspension: { at: Date; reason: string } | null, answer: SuspendState = { status: "idle" }) {
  const user = userEvent.setup();
  const suspend = vi.fn<(state: SuspendState, formData: FormData) => Promise<SuspendState>>().mockResolvedValue(answer);
  const unsuspend = vi.fn<() => Promise<void>>().mockResolvedValue();
  renderWithIntl(<SuspensionControl suspension={suspension} suspend={suspend} unsuspend={unsuspend} />);
  return { user, suspend, unsuspend };
}

describe("SuspensionControl", () => {
  it("suspends an online school with the reason the admin types", async () => {
    const { user, suspend } = setup(null);

    await user.click(await screen.findByText("Suspend…"));
    await user.type(screen.getByRole("textbox", { name: "Reason" }), "Pirated courses");
    await user.click(screen.getByRole("button", { name: "Suspend school" }));

    expect((suspend.mock.lastCall?.[1] as FormData).get("reason")).toBe("Pirated courses");
  });

  it("marks the reason invalid when the suspension rejects it", async () => {
    const { user } = setup(null, { status: "invalid" });

    await user.click(await screen.findByText("Suspend…"));
    await user.type(screen.getByRole("textbox", { name: "Reason" }), "x");
    await user.click(screen.getByRole("button", { name: "Suspend school" }));

    expect(await screen.findByRole("textbox", { name: "Reason" })).toHaveAccessibleDescription(expect.stringContaining("Say why the school is suspended."));
  });

  it("brings a suspended school back only after asking twice", async () => {
    const { user, unsuspend } = setup({ at: new Date("2026-10-20T03:00:00Z"), reason: "Spam" });

    await user.click(await screen.findByRole("button", { name: "Bring back online" }));
    expect(unsuspend).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Yes, bring it back" }));

    expect(unsuspend).toHaveBeenCalledOnce();
  });
});
