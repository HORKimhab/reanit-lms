import type { OrderDetail } from "@reanit/core/commerce";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ORDER } from "@/test/orders";
import { renderWithIntl } from "@/test/render";

import { OfflinePaymentReview } from "./offline-payment-review";

const AWAITING: OrderDetail = { ...ORDER, method: "offline_qr", status: "awaiting_confirmation", paymentReference: "ABA-778899" };

/**
 * Renders the review with a decision spy.
 *
 * @param order - The order.
 * @returns The user-event instance and the spy.
 */
async function render(order: OrderDetail = AWAITING) {
  const review = vi.fn<(decision: "confirm" | "reject") => Promise<void>>().mockResolvedValue(undefined);
  renderWithIntl(<OfflinePaymentReview order={order} review={review} />);
  await screen.findByRole("region", { name: "Offline payment" });
  return { user: userEvent.setup(), review };
}

describe("OfflinePaymentReview", () => {
  it("shows the student's reference and confirms the payment once asked twice", async () => {
    const { user, review } = await render();
    expect(screen.getByText(/with reference ABA-778899/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm payment" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Only confirm once $39.20 is in your account.");
    await user.click(screen.getByRole("button", { name: "Yes, I received it" }));

    expect(review).toHaveBeenCalledWith("confirm");
  });

  it("rejects the payment once asked twice", async () => {
    const { user, review } = await render();

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.click(screen.getByRole("button", { name: "Reject payment" }));

    expect(review).toHaveBeenCalledWith("reject");
  });

  it("says when the student has not said they paid", async () => {
    await render({ ...AWAITING, status: "pending", paymentReference: null });

    expect(screen.getByText(/hasn't said they paid \$39\.20 yet/)).toBeInTheDocument();
  });
});
