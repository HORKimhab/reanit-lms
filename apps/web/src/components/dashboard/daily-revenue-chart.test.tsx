import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import { DailyRevenueChart, type DayRevenue } from "./daily-revenue-chart";

const DAYS: DayRevenue[] = [
  { day: new Date("2026-10-01T00:00:00Z"), amount: 9800, sales: 2 },
  { day: new Date("2026-10-02T00:00:00Z"), amount: 0, sales: 0 },
  { day: new Date("2026-10-03T00:00:00Z"), amount: 4900, sales: 1 },
];

/**
 * Renders the USD chart of the test days.
 *
 * @param locale - UI locale.
 * @returns The chart.
 */
async function setup(locale: "en" | "km" = "en") {
  renderWithIntl(<DailyRevenueChart currency="USD" days={DAYS} />, { locale });
  return screen.findByRole("img");
}

describe("DailyRevenueChart", () => {
  it("names what it plots and labels the first and last day and round axis values", async () => {
    const chart = await setup();

    expect(chart).toHaveAccessibleName("Revenue per day in USD");
    expect(within(chart).getByText("Oct 1")).toBeInTheDocument();
    expect(within(chart).getByText("Oct 3")).toBeInTheDocument();
    expect(within(chart).getByText("$100")).toBeInTheDocument();
  });

  it("draws a column for each day with sales, none for an empty day", async () => {
    const chart = await setup();

    expect(chart.querySelectorAll("path")).toHaveLength(2);
  });

  it("shows a day's revenue and sales on hover", async () => {
    const chart = await setup();

    // Each day's whole band is its hover target; the third one is Oct 3.
    fireEvent.pointerEnter(chart.querySelectorAll("rect")[2] as Element);

    expect(screen.getByRole("status")).toHaveTextContent("$49.00 Oct 3 · 1 sale");
  });

  it("moves between days with the arrow keys once focused", async () => {
    const user = userEvent.setup();
    await setup();

    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("status")).toHaveTextContent("$98.00 Oct 1 · 2 sales");
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("status")).toHaveTextContent("Oct 3");
  });

  it("lists every day in a table view", async () => {
    await setup();

    const table = screen.getByRole("table", { hidden: true });
    expect(within(table).getAllByRole("row", { hidden: true })).toHaveLength(DAYS.length + 1);
  });

  it("uses Khmer labels when the locale is km", async () => {
    await setup("km");

    expect(screen.getByText("បង្ហាញជាតារាង")).toBeInTheDocument();
  });
});
