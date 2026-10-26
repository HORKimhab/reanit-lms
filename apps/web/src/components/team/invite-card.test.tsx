import type { InvitePreview } from "@reanit/core/schools";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AcceptInviteState } from "@/app/[locale]/(auth)/invite/[token]/actions";
import { renderWithIntl } from "@/test/render";

import { InviteCard } from "./invite-card";

const INVITE: InvitePreview = { email: "chenda@example.com", role: "admin", expiresAt: new Date("2026-11-02T12:00:00Z"), school: { name: "Angkor Academy", subdomain: "angkor" } };
const CHENDA = { id: "user-chenda", email: "chenda@example.com", name: "Chenda" };

/**
 * Renders the card for a visitor, with an accept action that answers as given.
 *
 * @param user - The signed-in user, or null.
 * @param answer - What accepting returns.
 * @param locale - UI locale.
 * @returns The accept spy.
 */
async function render(user: typeof CHENDA | null, answer: AcceptInviteState = { status: "idle" }, locale: "en" | "km" = "en") {
  const accept = vi.fn<(state: AcceptInviteState) => Promise<AcceptInviteState>>().mockResolvedValue(answer);
  renderWithIntl(<InviteCard invite={INVITE} user={user} returnPath="/invite/the-token" accept={accept} />, { locale });
  await screen.findByRole("heading", { name: locale === "en" ? "Join Angkor Academy" : "ចូលរួមជាមួយ Angkor Academy" });
  return accept;
}

describe("InviteCard", () => {
  it("says what the invite is for and sends a signed-out visitor to log in or sign up, then back", async () => {
    await render(null);

    expect(screen.getByText("You're invited as an admin. The invite was sent to chenda@example.com.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in to accept" })).toHaveAttribute("href", "/login?next=%2Finvite%2Fthe-token");
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup?next=%2Finvite%2Fthe-token");
    expect(screen.queryByRole("button", { name: "Accept invite" })).not.toBeInTheDocument();
  });

  it("accepts for the invited account", async () => {
    const accept = await render(CHENDA);

    await userEvent.setup().click(screen.getByRole("button", { name: "Accept invite" }));

    expect(accept).toHaveBeenCalledTimes(1);
  });

  it("says why accepting failed", async () => {
    await render(CHENDA, { status: "used" });

    await userEvent.setup().click(screen.getByRole("button", { name: "Accept invite" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This invite was already used or replaced by a newer one.");
  });

  it("tells someone signed in with another email to switch, offering no accept", async () => {
    await render({ ...CHENDA, email: "dara@example.com" });

    expect(screen.getByRole("alert")).toHaveTextContent("This invite is for chenda@example.com, but you're signed in as dara@example.com.");
    expect(screen.queryByRole("button", { name: "Accept invite" })).not.toBeInTheDocument();
  });

  it("is written in Khmer for km", async () => {
    await render(CHENDA, undefined, "km");

    expect(screen.getByRole("button", { name: "ទទួលយកការអញ្ជើញ" })).toBeInTheDocument();
  });
});
