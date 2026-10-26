import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { renderWithIntl } from "@/test/render";

import InvitePage from "./page";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));

/**
 * Renders the page for the test token.
 *
 * @returns The rendered page's promise.
 */
async function visit() {
  renderWithIntl(await InvitePage({ params: Promise.resolve({ locale: "en", token: "the-token" }), searchParams: Promise.resolve({}) }));
}

// The page only composes InviteCard, which has its own tests; its expired branch is tested here.
describe("InvitePage", () => {
  it("shows an open invite to a signed-out visitor", async () => {
    onApi("GET /invites/the-token", Response.json({ invite: { email: "chenda@example.com", role: "admin", expiresAt: "2026-11-02T12:00:00.000Z", school: { name: "Angkor Academy", subdomain: "angkor" } } }));

    await visit();

    expect(await screen.findByRole("heading", { name: "Join Angkor Academy" })).toBeInTheDocument();
  });

  it("says an expired invite expired", async () => {
    onApi("GET /invites/the-token", problem(410, "urn:reanit:problem:invite-expired"));

    await visit();

    expect(await screen.findByRole("heading", { name: "This invite has expired" })).toBeInTheDocument();
  });
});
