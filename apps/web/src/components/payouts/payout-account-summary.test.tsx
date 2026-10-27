import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SCHOOL_PAYOUTS } from "@/test/payouts";
import { renderWithIntl } from "@/test/render";

import { PayoutAccountSummary } from "./payout-account-summary";

describe("PayoutAccountSummary", () => {
  it("shows where payouts go without letting the admin change it", async () => {
    renderWithIntl(<PayoutAccountSummary account={SCHOOL_PAYOUTS.account} />);

    expect(await screen.findByText("Only the school's owner can change where payouts are sent.")).toBeInTheDocument();
    expect(screen.getAllByRole("definition").map((value) => value.textContent)).toEqual(["Dara Kim", "ABA", "000 123 456"]);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("says the owner has not added details yet", async () => {
    renderWithIntl(<PayoutAccountSummary account={null} />);

    expect(await screen.findByText("The owner hasn't added payout details yet.")).toBeInTheDocument();
  });
});
