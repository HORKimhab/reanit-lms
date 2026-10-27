import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PlanCheckoutState } from "@/app/[locale]/dashboard/plan/actions";
import { renderWithIntl } from "@/test/render";

import { PlanCheckoutForm } from "./plan-checkout-form";

/**
 * Renders the form with a checkout action that answers as given.
 *
 * @param answer - What the action returns.
 * @param current - The school's paid plan.
 * @returns The user-event instance and the action spy.
 */
async function setup(answer: PlanCheckoutState, current: "pro" | "business" | null = null) {
  const user = userEvent.setup();
  const action = vi.fn<(state: PlanCheckoutState, formData: FormData) => Promise<PlanCheckoutState>>().mockResolvedValue(answer);
  renderWithIntl(
    <PlanCheckoutForm methods={["aba_payway", "bakong_khqr"]} current={current} action={action} checkStatus={vi.fn().mockResolvedValue("pending")} paymentHref={(id) => `/dashboard/plan?planPayment=${id}`} />,
  );
  await screen.findByRole("group", { name: "Plan" });
  return { user, action };
}

describe("PlanCheckoutForm", () => {
  it("pays for the picked plan and period with the picked method, showing its price", async () => {
    const { user, action } = await setup({ status: "unavailable" });
    expect(screen.getByRole("radio", { name: "Pro" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Business" }));
    await user.click(screen.getByRole("radio", { name: "year" }));
    await user.click(screen.getByRole("button", { name: "Pay $990.00" }));

    expect(Object.fromEntries((action.mock.calls[0]?.[1] as FormData).entries())).toEqual({ plan: "business", interval: "year", method: "aba_payway" });
    expect(await screen.findByRole("alert")).toHaveTextContent("This payment method can't take this payment.");
  });

  it("starts from the plan the school pays for", async () => {
    await setup({ status: "idle" }, "business");

    expect(screen.getByRole("radio", { name: "Business" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Pay $99.00" })).toBeInTheDocument();
  });

  it("shows a KHQR code to pay the plan", async () => {
    const { user } = await setup({ status: "qr", qr: "000201", expiresAt: "2026-10-27T12:15:00.000Z", paymentId: "payment-1" });

    await user.click(screen.getByRole("button", { name: "Pay $29.00" }));

    expect(await screen.findByRole("img", { name: /\$29\.00/ })).toBeInTheDocument();
  });
});
