import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { TeamInviteState } from "@/app/[locale]/dashboard/settings/actions";
import { renderWithIntl } from "@/test/render";

import { InviteForm } from "./invite-form";

/**
 * Renders the form with an invite action that answers as given, then invites someone.
 *
 * @param answer - What inviting returns.
 * @param locale - UI locale.
 * @returns The action spy.
 */
async function invite(answer: TeamInviteState, locale: "en" | "km" = "en") {
  const user = userEvent.setup();
  const action = vi.fn<(state: TeamInviteState, formData: FormData) => Promise<TeamInviteState>>().mockResolvedValue(answer);
  renderWithIntl(<InviteForm action={action} />, { locale });
  await user.type(await screen.findByRole("textbox"), "chenda@example.com");
  await user.selectOptions(screen.getByRole("combobox"), locale === "en" ? "Admin" : "អ្នកគ្រប់គ្រង");
  await user.click(screen.getByRole("button"));
  return action;
}

describe("InviteForm", () => {
  it("sends the email and role, then says the invite went out", async () => {
    const action = await invite({ status: "sent" });

    expect(await screen.findByRole("status")).toHaveTextContent("Invite sent. The link works for 7 days.");
    expect(Object.fromEntries((action.mock.calls[0]?.[1] as FormData).entries())).toEqual({ email: "chenda@example.com", role: "admin" });
  });

  it("marks the email when the person is already on the team", async () => {
    await invite({ status: "member" });

    expect(await screen.findByRole("textbox", { name: "Email" })).toHaveAccessibleDescription("This person is already on the team.");
  });

  it("is written in Khmer for km", async () => {
    await invite({ status: "sent" }, "km");

    expect(await screen.findByRole("status")).toHaveTextContent("បានផ្ញើការអញ្ជើញ");
  });
});
