import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SCHOOL_PAYOUTS } from "@/test/payouts";
import { renderWithIntl } from "@/test/render";

import { PayoutBalances } from "./payout-balances";

describe("PayoutBalances", () => {
  it("shows each currency's available and held balance, the next payout and the minimums", async () => {
    renderWithIntl(<PayoutBalances payouts={SCHOOL_PAYOUTS} />);

    const table = await screen.findByRole("table", { name: "Balance" });
    expect(within(table).getAllByRole("row").map((row) => row.textContent)).toEqual(["CurrencyAvailableOn hold", "USD$123.45$20.00", "KHR-KHR\u00a04,000KHR\u00a00"]);
    expect(screen.getByText("Next payout: Nov 1, 2026, for balances of at least $10.00 and KHR 40,000.")).toBeInTheDocument();
    expect(screen.getByText(/held for 7 days/)).toBeInTheDocument();
    expect(screen.getByText(/negative balance is the platform's fee/)).toBeInTheDocument();
  });

  it("says there is nothing to pay out before the first sale, and leaves out the negative balance note", async () => {
    renderWithIntl(<PayoutBalances payouts={{ ...SCHOOL_PAYOUTS, balances: [{ currency: "USD", available: 0, onHold: 500 }] }} />);
    expect(await screen.findByRole("table", { name: "Balance" })).toBeInTheDocument();
    expect(screen.queryByText(/negative balance/)).not.toBeInTheDocument();

    renderWithIntl(<PayoutBalances payouts={{ ...SCHOOL_PAYOUTS, balances: [] }} />);
    expect(await screen.findByText("Nothing to pay out yet. Your sales show here once they're paid.")).toBeInTheDocument();
  });

  it("gives the payout day as the 1st even west of UTC, where it starts the evening before", async () => {
    renderWithIntl(<PayoutBalances payouts={SCHOOL_PAYOUTS} />, { timeZone: "America/Los_Angeles" });

    expect(await screen.findByText(/^Next payout: Nov 1, 2026,/)).toBeInTheDocument();
  });

  it("is written in Khmer for km", async () => {
    renderWithIntl(<PayoutBalances payouts={SCHOOL_PAYOUTS} />, { locale: "km" });

    expect(await screen.findByRole("heading", { name: "សមតុល្យ" })).toBeInTheDocument();
  });
});
