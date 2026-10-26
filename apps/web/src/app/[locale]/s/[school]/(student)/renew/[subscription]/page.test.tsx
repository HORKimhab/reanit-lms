import { describe, expect, it, vi } from "vitest";

import { onApi } from "@/test/api";
import { NotFoundError } from "@/test/navigation";
import { signIn } from "@/test/session";

import RenewPage from "./page";

vi.mock("next/headers", () => import("@/test/headers"));
vi.mock("next-intl/server", () => import("@/test/intl-server"));

const SUBSCRIPTION_ID = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a30";

/**
 * Answers the student's subscriptions with one in the given status.
 *
 * @param status - Its status.
 */
function answerWith(status: "active" | "completed") {
  signIn();
  onApi(
    "GET /schools/by-subdomain/angkor/subscriptions",
    Response.json({
      subscriptions: [
        {
          id: SUBSCRIPTION_ID,
          status,
          title: "Design Club",
          price: { amount: 1500, currency: "USD", billing: { kind: "recurring", interval: "month" } },
          methods: ["aba_payway"],
          paidPeriods: 1,
          currentPeriodEnd: "2026-11-01T09:00:00.000Z",
        },
      ],
    }),
  );
}

/**
 * Renders the page for the test subscription.
 *
 * @returns The rendered page's promise.
 */
function visit() {
  return RenewPage({ params: Promise.resolve({ locale: "en", school: "angkor", subscription: SUBSCRIPTION_ID }), searchParams: Promise.resolve({}) });
}

// The page only composes ProductCheckout, whose form has its own tests; its paid-off branch is tested here.
describe("RenewPage", () => {
  it("offers to pay a running subscription's next period, at its price, with its methods", async () => {
    answerWith("active");

    // ProductCheckout is an async server component, so the page's element is checked rather than rendered.
    const page = await visit();

    expect(page.props).toMatchObject({
      purchase: { subscriptionId: SUBSCRIPTION_ID },
      title: "Design Club",
      offer: { price: { amount: 1500, billing: { kind: "recurring", interval: "month" } }, methods: ["aba_payway"] },
    });
  });

  it("is not found for a paid-off plan", async () => {
    answerWith("completed");

    await expect(visit()).rejects.toThrow(NotFoundError);
  });
});
