import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";
import { SALES_REPORT } from "@/test/stats";

import { SalesReport } from "./sales-report";

describe("SalesReport", () => {
  it("leads with revenue per currency, sales and refunds", async () => {
    renderWithIntl(<SalesReport report={SALES_REPORT} />);

    const tiles = (await screen.findAllByRole("term")).map((term) => [term.textContent, term.nextElementSibling?.textContent]);
    expect(tiles).toEqual([
      ["Revenue", "KHR\u00a020,000$98.00"],
      ["Sales", "3"],
      ["Refunds", "$49.00 1 order"],
    ]);
  });

  it("charts each currency apart, never on one axis", async () => {
    renderWithIntl(<SalesReport report={SALES_REPORT} />);

    expect((await screen.findAllByRole("img")).map((chart) => chart.getAttribute("aria-label"))).toEqual(["Revenue per day in KHR", "Revenue per day in USD"]);
  });

  it("lists sales per course, linking each to its builder", async () => {
    renderWithIntl(<SalesReport report={SALES_REPORT} />);

    const table = await screen.findByRole("table", { name: "Sales by course" });
    expect(within(table).getByRole("link", { name: "Logo" })).toHaveAttribute("href", "/dashboard/courses/logo");
  });

  it("says when the range had no sales, with no refunds", async () => {
    renderWithIntl(<SalesReport report={{ ...SALES_REPORT, daily: [], byCourse: [], totals: { sales: 0, revenue: [] }, refunds: [] }} />);

    expect(await screen.findByText("No sales in this range.")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
