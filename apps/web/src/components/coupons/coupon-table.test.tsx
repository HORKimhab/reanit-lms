import type { Coupon } from "@reanit/core/commerce";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import { CouponTable } from "./coupon-table";

const PERCENT: Coupon = {
  id: "c1",
  code: "SAVE20",
  kind: "percent",
  percentOff: 20,
  expiresAt: new Date("2026-12-31T23:59:59.999Z"),
  maxRedemptions: 50,
  redemptions: 3,
};
const FIXED: Coupon = { id: "c2", code: "RIEL5K", kind: "fixed", amountOff: 500_000, currency: "KHR", expiresAt: null, maxRedemptions: null, redemptions: 1200 };

/**
 * Renders the table and returns its body rows' cell texts.
 *
 * @param coupons - The coupons.
 * @param locale - UI locale.
 * @returns Each row's cells, as text.
 */
async function rows(coupons: Coupon[], locale: "en" | "km" = "en") {
  renderWithIntl(<CouponTable coupons={coupons} deleteAction={vi.fn()} />, { locale });
  const table = await screen.findByRole("table");
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => [...within(row).getAllByRole("rowheader"), ...within(row).getAllByRole("cell")].map((cell) => cell.textContent));
}

describe("CouponTable", () => {
  it("shows each coupon's discount, uses against its limit, and when it ends", async () => {
    expect(await rows([PERCENT, FIXED])).toEqual([
      ["SAVE20", "20% off", "3 of 50", "Dec 31, 2026, 11:59 PM", ""],
      ["RIEL5K", "KHR\u00a05,000 off", "1,200", "Never", ""],
    ]);
  });

  it("formats amounts the Khmer way when the locale is km", async () => {
    expect((await rows([FIXED], "km"))[0]?.[1]).toBe("បញ្ចុះ 5,000៛");
  });

  it("deletes the coupon whose button is pressed", async () => {
    const user = userEvent.setup();
    const deleteAction = vi.fn().mockResolvedValue(undefined);
    renderWithIntl(<CouponTable coupons={[PERCENT, FIXED]} deleteAction={deleteAction} />);

    await user.click(await screen.findByRole("button", { name: "Delete coupon RIEL5K" }));

    expect(deleteAction).toHaveBeenCalledTimes(1);
    expect(deleteAction.mock.calls[0]?.[0]).toBe("c2");
  });

  it("shows an empty state when the school has no coupons", async () => {
    renderWithIntl(<CouponTable coupons={[]} deleteAction={vi.fn()} />);

    expect(await screen.findByText("No coupons yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
