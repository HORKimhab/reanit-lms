import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { onApi, requestTo } from "@/test/api";
import { PAYOUTS_JSON } from "@/test/payouts";
import { renderWithIntl } from "@/test/render";
import { signInAsStaff } from "@/test/staff";

import DashboardPayouts from "./page";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));

/**
 * Renders the page for a staff member with the given role.
 *
 * @param role - Their role in the school.
 */
async function visitAs(role: "owner" | "admin" | "instructor") {
  signInAsStaff(role);
  onApi("GET /schools/current/payouts", Response.json(PAYOUTS_JSON));
  renderWithIntl(await DashboardPayouts());
}

// The page only composes the payout components, which have their own tests; its role branches are tested here.
describe("DashboardPayouts", () => {
  it("lets the owner change the payout details", async () => {
    await visitAs("owner");

    expect(await screen.findByRole("table", { name: "Payout history" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Account holder" })).toHaveValue("Dara Kim");
  });

  it("shows an admin the payout details read-only", async () => {
    await visitAs("admin");

    expect(await screen.findByText("Only the school's owner can change where payouts are sent.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("tells an instructor they cannot see the payouts, without asking the API for them", async () => {
    await visitAs("instructor");

    expect(await screen.findByText("Only the school's owner and admins can see its payouts.")).toBeInTheDocument();
    expect(requestTo("GET /schools/current/payouts")).toBeUndefined();
  });
});
