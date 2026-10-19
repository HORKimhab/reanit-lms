import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BUNDLE } from "@/test/bundles";
import { renderWithIntl } from "@/test/render";

import { BundleTable } from "./bundle-table";

describe("BundleTable", () => {
  it("shows each bundle's course count, price and status, linking to its editor", async () => {
    renderWithIntl(<BundleTable bundles={[BUNDLE, { ...BUNDLE, id: "b2", slug: "draft-kit", title: "Draft Kit", status: "draft", price: null }]} />);

    const rows = within(await screen.findByRole("table")).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent))).toEqual([
      ["2 courses", "$99.00", "Published"],
      ["2 courses", "No price yet", "Draft"],
    ]);
    expect(screen.getByRole("link", { name: "Draft Kit" })).toHaveAttribute("href", "/dashboard/bundles/draft-kit");
  });

  it("shows an empty state when the school has no bundles", async () => {
    renderWithIntl(<BundleTable bundles={[]} />);

    expect(await screen.findByText("No bundles yet")).toBeInTheDocument();
  });
});
