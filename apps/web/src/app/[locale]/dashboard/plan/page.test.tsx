import { PLAN_TERMS } from "@reanit/core/schools";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { onApi, requestTo } from "@/test/api";
import { renderWithIntl } from "@/test/render";
import { signInAsStaff } from "@/test/staff";

import DashboardPlan from "./page";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));

const PAYMENT_ID = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a70";

/**
 * Answers the plan page's API calls for a staff member with the given role.
 *
 * @param role - Their role in the school.
 */
function answerAs(role: "owner" | "admin" | "instructor") {
  signInAsStaff(role);
  onApi("GET /schools/current/plan", Response.json({ plan: "free", terms: PLAN_TERMS.free, paid: null, methods: ["aba_payway"] }));
}

/**
 * Renders the page for a URL query.
 *
 * @param query - The search params.
 */
async function visit(query: Record<string, string> = {}) {
  renderWithIntl(await DashboardPlan({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve(query) }));
}

// The page only composes the plan components, which have their own tests; its role and payment branches are tested here.
describe("DashboardPlan", () => {
  it("lets the owner pay for a plan", async () => {
    answerAs("owner");

    await visit();

    expect(await screen.findByRole("heading", { name: "You're on Free" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay $29.00" })).toBeInTheDocument();
  });

  it("shows an admin the plan, but leaves paying to the owner", async () => {
    answerAs("admin");

    await visit();

    expect(await screen.findByText("Only the school's owner can pay for its plan.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Pay/ })).not.toBeInTheDocument();
  });

  it("says how the payment the owner came back from went", async () => {
    answerAs("owner");
    onApi(`GET /schools/current/plan/payments/${PAYMENT_ID}`, Response.json({ status: "paid" }));

    await visit({ planPayment: PAYMENT_ID });

    expect(await screen.findByRole("status")).toHaveTextContent("Payment received. Your plan is updated.");
  });

  it("tells an instructor they cannot see the plan, without asking the API for it", async () => {
    signInAsStaff("instructor");

    await visit();

    expect(await screen.findByText("Only the school's owner and admins can see its plan.")).toBeInTheDocument();
    expect(requestTo("GET /schools/current/plan")).toBeUndefined();
  });
});
