import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getMockCourseSales } from "@/mocks/sales";
import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { renderWithIntl } from "@/test/render";

import { SalesOverview } from "./sales-overview";

const SALES = getMockCourseSales(MOCK_SCHOOL_SLUG);

/**
 * Finds the figure shown under a stat tile's label.
 *
 * @param label - The tile's label.
 * @returns The definition element holding the figure.
 */
function statOf(label: string) {
  // The label also names a table column, so match only the tile's term.
  return screen.getByText(label, { selector: "dt" }).nextElementSibling as HTMLElement;
}

describe("SalesOverview", () => {
  it("shows revenue per currency, total students and the completion rate", async () => {
    renderWithIntl(<SalesOverview sales={SALES} />);
    expect(await screen.findByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
    const revenue = within(statOf("Revenue"));
    expect(revenue.getByText("$6,272.00")).toBeInTheDocument();
    expect(revenue.getByText("KHR 6,480,000")).toBeInTheDocument();
    expect(statOf("Students")).toHaveTextContent("182");
    expect(statOf("Completion rate")).toHaveTextContent("35%");
  });

  it("lists the top courses and links to the full course list", async () => {
    renderWithIntl(<SalesOverview sales={SALES} />);
    const table = await screen.findByRole("table", { name: "Top courses" });
    expect(within(table).getAllByRole("rowheader").map((h) => h.textContent)).toEqual([
      "Brand Design Basics",
      "Social Media Content That Sells",
    ]);
    expect(screen.getByRole("link", { name: "View all courses" })).toHaveAttribute("href", "/dashboard/courses");
  });

  it("shows no sales, zero students and an empty course list when the school has no courses", async () => {
    renderWithIntl(<SalesOverview sales={[]} />);
    expect(await screen.findByText("No sales yet")).toBeInTheDocument();
    expect(statOf("Students")).toHaveTextContent("0");
    expect(statOf("Completion rate")).toHaveTextContent("0%");
    expect(screen.getByText("No courses yet")).toBeInTheDocument();
  });

  it("uses Khmer labels when the locale is km", async () => {
    renderWithIntl(<SalesOverview sales={SALES} />, { locale: "km" });
    expect(await screen.findByRole("heading", { level: 1, name: "ទិដ្ឋភាពទូទៅ" })).toBeInTheDocument();
    expect(screen.getByText("អត្រាបញ្ចប់")).toBeInTheDocument();
  });
});
