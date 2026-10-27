import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PlanCheckoutState } from "@/app/[locale]/dashboard/plan/actions";
import type { OfflinePaymentState } from "@/app/[locale]/s/[school]/(student)/checkout/actions";
import { renderWithIntl } from "@/test/render";

import { PlanCheckoutForm } from "./plan-checkout-form";

/**
 * Renders the form with a checkout action that answers as given.
 *
 * @param answer - What the action returns.
 * @param current - The school's paid plan.
 * @returns The user-event instance, the action spy and the transfer spy.
 */
async function setup(answer: PlanCheckoutState, current: "pro" | "business" | null = null) {
  const user = userEvent.setup();
  const action = vi.fn<(state: PlanCheckoutState, formData: FormData) => Promise<PlanCheckoutState>>().mockResolvedValue(answer);
  const submitTransfer = vi.fn<(paymentId: string, state: OfflinePaymentState, formData: FormData) => Promise<OfflinePaymentState>>().mockResolvedValue({ status: "closed" });
  renderWithIntl(
    <PlanCheckoutForm
      methods={["offline_qr", "aba_payway", "bakong_khqr"]}
      current={current}
      action={action}
      checkStatus={vi.fn().mockResolvedValue("pending")}
      submitTransfer={submitTransfer}
      paymentHref={(id) => `/dashboard/plan?planPayment=${id}`}
    />,
  );
  await screen.findByRole("group", { name: "Plan" });
  return { user, action, submitTransfer };
}

describe("PlanCheckoutForm", () => {
  it("pays for the picked plan and period with the picked method, showing its price", async () => {
    const { user, action } = await setup({ status: "unavailable" });
    expect(screen.getByRole("radio", { name: "Pro" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Business" }));
    await user.click(screen.getByRole("radio", { name: "year" }));
    await user.click(screen.getByRole("button", { name: "Pay $990.00" }));

    expect(Object.fromEntries((action.mock.calls[0]?.[1] as FormData).entries())).toEqual({ plan: "business", interval: "year", method: "offline_qr" });
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

  it("shows the platform's QR, then sends the transfer's reference for the payment", async () => {
    const { user, submitTransfer } = await setup({ status: "offline", qrImageUrl: "https://cdn.reanit.test/platform-qr.png", paymentId: "payment-1" });

    await user.click(screen.getByRole("button", { name: "Pay $29.00" }));
    expect(await screen.findByRole("img", { name: "The platform's payment QR, to pay $29.00" })).toHaveAttribute("src", "https://cdn.reanit.test/platform-qr.png");
    await user.type(screen.getByRole("textbox", { name: "Transaction reference" }), "ABA-123");
    await user.click(screen.getByRole("button", { name: "I've paid" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This plan payment no longer waits for a transfer. Start again below.");
    expect(submitTransfer.mock.calls[0]?.[0]).toBe("payment-1");
    expect((submitTransfer.mock.calls[0]?.[2] as FormData).get("reference")).toBe("ABA-123");
  });
});
