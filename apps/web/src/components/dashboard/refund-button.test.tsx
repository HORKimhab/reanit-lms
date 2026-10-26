import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ORDER } from "@/test/orders";
import { renderWithIntl } from "@/test/render";

import { RefundButton } from "./refund-button";

/**
 * Renders the button for an order with a refund spy, and opens its confirmation.
 *
 * @param order - The order.
 * @param locale - The UI language.
 * @returns The user-event instance and the spy.
 */
async function openRefund(order = ORDER, locale: "en" | "km" = "en") {
  const user = userEvent.setup();
  const refund = vi.fn<(isRefundedByHand: boolean) => Promise<void>>().mockResolvedValue(undefined);
  renderWithIntl(<RefundButton order={order} refund={refund} />, { locale });
  await user.click(await screen.findByRole("button", { name: locale === "en" ? "Refund order" : "សងប្រាក់ការបញ្ជាទិញ" }));
  return { user, refund };
}

describe("RefundButton", () => {
  it("refunds a Stripe order through the gateway once confirmed", async () => {
    const { user, refund } = await openRefund();
    expect(screen.getByRole("alert")).toHaveTextContent("This refunds $39.20 to the student's card");
    expect(refund).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Refund $39.20" }));

    expect(refund).toHaveBeenCalledWith(false);
  });

  it("has staff confirm they paid a KHQR student back themselves", async () => {
    const { user, refund } = await openRefund({ ...ORDER, method: "bakong_khqr" });
    expect(screen.getByRole("alert")).toHaveTextContent("Bakong KHQR can't refund automatically. Pay the student back $39.20 yourself first");

    await user.click(screen.getByRole("button", { name: "I paid them back: mark refunded" }));

    expect(refund).toHaveBeenCalledWith(true);
  });

  it("goes back without refunding when cancelled", async () => {
    const { user, refund } = await openRefund();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Refund order" })).toBeInTheDocument();
    expect(refund).not.toHaveBeenCalled();
  });

  it("is written in Khmer for km", async () => {
    await openRefund(ORDER, "km");

    expect(screen.getByRole("button", { name: /^សងប្រាក់ / })).toBeInTheDocument();
  });
});
