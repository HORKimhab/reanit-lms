import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SCHOOL_PAYOUTS } from "@/test/payouts";
import { renderWithIntl } from "@/test/render";

import { PayoutHistory } from "./payout-history";

describe("PayoutHistory", () => {
  it("lists each payout's date, amount and reference", async () => {
    renderWithIntl(<PayoutHistory payouts={SCHOOL_PAYOUTS.payouts} />);

    const table = await screen.findByRole("table", { name: "Payout history" });
    expect(within(table).getAllByRole("row").map((row) => row.textContent)).toEqual(["Paid onAmountReference", "Oct 1, 2026$50.00ABA-778"]);
  });

  it("says there are no payouts yet", async () => {
    renderWithIntl(<PayoutHistory payouts={[]} />);

    expect(await screen.findByText("No payouts yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
