import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ORDER } from "@/test/orders";
import { renderWithIntl } from "@/test/render";

import { PurchaseList } from "./purchase-list";

/**
 * Links another page of purchases.
 *
 * @param page - The page.
 * @returns The link target.
 */
function hrefFor(page: number) {
  return { pathname: "/s/angkor/purchases", query: { page } };
}

describe("PurchaseList", () => {
  it("shows a receipt per order and links the next page", async () => {
    renderWithIntl(<PurchaseList result={{ orders: [ORDER], total: 60, page: 1, pageSize: 50 }} hrefFor={hrefFor} />);

    expect(await screen.findByRole("article", { name: "Order 6F1C1F3E" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute("href", "/s/angkor/purchases?page=2");
  });

  it("says there are no purchases yet", async () => {
    renderWithIntl(<PurchaseList result={{ orders: [], total: 0, page: 1, pageSize: 50 }} hrefFor={hrefFor} />);

    expect(await screen.findByText("No purchases yet")).toBeInTheDocument();
  });
});
