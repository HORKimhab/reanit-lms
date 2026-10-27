import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SUBMITTED_PLAN_PAYMENT } from "@/test/admin";
import { renderWithIntl } from "@/test/render";

import { PlanPaymentTable } from "./plan-payment-table";

/**
 * Renders the table with one waiting payment and a decision spy.
 *
 * @returns The user-event instance and the spy.
 */
function setup() {
  const user = userEvent.setup();
  const decide = vi.fn<(paymentId: string, decision: "confirm" | "reject") => Promise<void>>().mockResolvedValue();
  renderWithIntl(<PlanPaymentTable payments={[SUBMITTED_PLAN_PAYMENT]} decide={decide} />);
  return { user, decide };
}

describe("PlanPaymentTable", () => {
  it("shows what to look for, and confirms a payment only after asking twice", async () => {
    const { user, decide } = setup();

    const row = within(await screen.findByRole("table", { name: "Plan payments waiting" })).getAllByRole("row")[1]!;
    expect(within(row).getAllByRole("cell").slice(0, 3).map((cell) => cell.textContent)).toEqual(["Pro, every month", "$29.00", "ABA-123"]);
    await user.click(within(row).getByRole("button", { name: "Confirm" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Only confirm once $29.00 with reference ABA-123 is in the platform's account.");
    await user.click(screen.getByRole("button", { name: "Yes, it arrived" }));

    expect(decide).toHaveBeenCalledWith(SUBMITTED_PLAN_PAYMENT.id, "confirm");
  });

  it("rejects a payment", async () => {
    const { user, decide } = setup();

    await user.click(await screen.findByRole("button", { name: "Reject" }));
    await user.click(screen.getByRole("button", { name: "Yes, it never arrived" }));

    expect(decide).toHaveBeenCalledWith(SUBMITTED_PLAN_PAYMENT.id, "reject");
  });

  it("says when nothing is waiting", async () => {
    renderWithIntl(<PlanPaymentTable payments={[]} decide={vi.fn()} />);

    expect(await screen.findByText("No creator is waiting on a plan payment by QR.")).toBeInTheDocument();
  });
});
