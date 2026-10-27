import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { RecordPayoutState } from "@/app/[locale]/admin/actions";
import { DUE_PAYOUT } from "@/test/admin";
import { renderWithIntl } from "@/test/render";

import { DuePayoutList } from "./due-payout-list";

/**
 * Builds a record action that answers with the given state.
 *
 * @param result - What recording returns.
 * @returns The spy.
 */
function recording(result: RecordPayoutState) {
  return vi.fn<(state: RecordPayoutState, formData: FormData) => Promise<RecordPayoutState>>().mockResolvedValue(result);
}

describe("DuePayoutList", () => {
  it("shows where to send the amount due, and records the transfer from the admin's day", async () => {
    const user = userEvent.setup();
    const record = recording({ status: "recorded" });
    renderWithIntl(<DuePayoutList payouts={[DUE_PAYOUT]} record={record} />);
    const card = await screen.findByRole("listitem", { name: "Angkor Academy: $46.55" });
    expect(within(card).getByText("Send to Sokha Chan, ABA, 000 123 456")).toBeInTheDocument();
    expect(within(card).getByRole("textbox", { name: "Amount (USD)" })).toHaveValue("46.55");

    await user.clear(within(card).getByLabelText("Sent on"));
    await user.type(within(card).getByLabelText("Sent on"), "2026-11-01");
    await user.type(within(card).getByRole("textbox", { name: "Bank reference" }), "ABA-TRX-1");
    await user.click(within(card).getByRole("button", { name: "Record payout" }));

    expect(await within(card).findByRole("status")).toHaveTextContent("Payout recorded.");
    const formData = record.mock.lastCall?.[1];
    expect(["schoolId", "currency", "amount", "paidAt", "reference"].map((name) => formData?.get(name))).toEqual([
      DUE_PAYOUT.school.id,
      "USD",
      "46.55",
      new Date(2026, 10, 1).toISOString(),
      "ABA-TRX-1",
    ]);
  });

  it("warns when the owner has no payout details, and says when the amount is more than the balance", async () => {
    const user = userEvent.setup();
    renderWithIntl(<DuePayoutList payouts={[{ ...DUE_PAYOUT, account: null }]} record={recording({ status: "exceeds" })} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("The owner hasn't added payout details yet.");

    await user.type(screen.getByRole("textbox", { name: "Bank reference" }), "ABA-TRX-1");
    await user.click(screen.getByRole("button", { name: "Record payout" }));

    expect(await screen.findByRole("textbox", { name: "Amount (USD)" })).toHaveAccessibleDescription("That's more than the school's available balance.");
  });

  it("says when no payout is due", async () => {
    renderWithIntl(<DuePayoutList payouts={[]} record={recording({ status: "idle" })} />);

    expect(await screen.findByText("No school's available balance has reached the minimum.")).toBeInTheDocument();
  });
});
