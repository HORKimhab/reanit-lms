import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import { PlanComparison } from "./plan-comparison";

/**
 * Finds a row of the comparison by the name it starts with.
 *
 * @param table - The comparison table.
 * @param name - The row's heading.
 * @returns The row.
 */
function row(table: HTMLElement, name: string) {
  return within(table).getByRole("row", { name: new RegExp(`^${name}`) });
}

describe("PlanComparison", () => {
  it("compares each plan's price, fee, limits and features", async () => {
    renderWithIntl(<PlanComparison />);

    const table = await screen.findByRole("table", { name: "Plans compared" });
    expect(row(table, "Price")).toHaveTextContent("Free$29.00 a month, or $290.00 a year$99.00 a month, or $990.00 a year");
    expect(row(table, "Fee on each sale")).toHaveTextContent("10%5%2%");
    expect(row(table, "Published courses")).toHaveTextContent("3UnlimitedUnlimited");
    expect(row(table, "Team members")).toHaveTextContent("03Unlimited");
    expect(within(row(table, "Custom domain")).getAllByRole("img").map((icon) => icon.getAttribute("aria-label"))).toEqual(["Not included", "Included", "Included"]);
  });

  it("marks the school's plan", async () => {
    renderWithIntl(<PlanComparison current="pro" />);

    expect(await screen.findByRole("columnheader", { name: "Pro (yours)" })).toBeInTheDocument();
  });

  it("is written in Khmer for km", async () => {
    renderWithIntl(<PlanComparison />, { locale: "km" });

    expect(await screen.findByRole("table", { name: "ការប្រៀបធៀបគម្រោង" })).toBeInTheDocument();
  });
});
