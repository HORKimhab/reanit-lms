import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PayoutAccountState } from "@/app/[locale]/dashboard/payouts/actions";
import { SCHOOL_PAYOUTS } from "@/test/payouts";
import { renderWithIntl } from "@/test/render";

import { PayoutAccountForm } from "./payout-account-form";

/**
 * Builds a save action that answers with the given state.
 *
 * @param result - What saving returns.
 * @returns The spy.
 */
function saving(result: PayoutAccountState) {
  return vi.fn<(state: PayoutAccountState, formData: FormData) => Promise<PayoutAccountState>>().mockResolvedValue(result);
}

describe("PayoutAccountForm", () => {
  it("shows the saved details and sends what the owner changes", async () => {
    const user = userEvent.setup();
    const save = saving({ status: "saved" });
    renderWithIntl(<PayoutAccountForm account={SCHOOL_PAYOUTS.account} save={save} />);
    const bank = await screen.findByRole("textbox", { name: "Bank" });
    expect(screen.getByRole("textbox", { name: "Account holder" })).toHaveValue("Dara Kim");

    await user.clear(bank);
    await user.type(bank, "Bakong");
    await user.click(screen.getByRole("button", { name: "Save payout details" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Payout details saved.");
    const formData = save.mock.lastCall?.[1];
    expect(["holderName", "bankName", "account"].map((name) => formData?.get(name))).toEqual(["Dara Kim", "Bakong", "000 123 456"]);
  });

  it("asks for the details when there are none, and marks them invalid when the save rejects them", async () => {
    const user = userEvent.setup();
    renderWithIntl(<PayoutAccountForm account={null} save={saving({ status: "invalid" })} />);
    expect(await screen.findByText("Add where to send your payouts. We can't pay you until you do.")).toBeInTheDocument();

    // The browser would block the empty required fields; fill them so the save's answer is what is shown.
    await user.type(screen.getByRole("textbox", { name: "Account holder" }), "Dara");
    await user.type(screen.getByRole("textbox", { name: "Bank" }), "ABA");
    await user.type(screen.getByRole("textbox", { name: "Account number or Bakong ID" }), "1");
    await user.click(screen.getByRole("button", { name: "Save payout details" }));

    expect(await screen.findByRole("textbox", { name: "Account holder" })).toHaveAccessibleDescription(
      "Fill in every field. Keep the holder and bank to 100 characters, and the account to 64.",
    );
  });

  it("is written in Khmer for km", async () => {
    renderWithIntl(<PayoutAccountForm account={null} save={saving({ status: "idle" })} />, { locale: "km" });

    expect(await screen.findByRole("heading", { name: "ព័ត៌មានទូទាត់ចេញ" })).toBeInTheDocument();
  });
});
