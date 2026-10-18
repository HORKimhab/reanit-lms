import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type * as SalesModule from "@/mocks/sales";
import { renderWithIntl } from "@/test/render";

import DashboardOverview from "./page";

const salesState = vi.hoisted(() => ({ isEmpty: false }));

// Sales data is the page's data boundary: an empty school has no courses to sell.
vi.mock("@/mocks/sales", async (importOriginal) => {
  const actual = await importOriginal<typeof SalesModule>();
  /**
   * Returns no sales while the test sets `salesState.isEmpty`, otherwise the real mock sales.
   *
   * @param schoolSlug - The school's slug.
   * @returns The school's per-course sales.
   */
  function getMockCourseSales(schoolSlug: string) {
    return salesState.isEmpty ? [] : actual.getMockCourseSales(schoolSlug);
  }
  return { ...actual, getMockCourseSales };
});

afterEach(() => {
  salesState.isEmpty = false;
});

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

describe("DashboardOverview", () => {
  it("shows revenue per currency, total students and the completion rate", async () => {
    renderWithIntl(<DashboardOverview />);
    expect(await screen.findByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
    const revenue = within(statOf("Revenue"));
    expect(revenue.getByText("$6,272.00")).toBeInTheDocument();
    expect(revenue.getByText("KHR 6,480,000")).toBeInTheDocument();
    expect(statOf("Students")).toHaveTextContent("182");
    expect(statOf("Completion rate")).toHaveTextContent("35%");
  });

  it("lists the top courses and links to the full course list", async () => {
    renderWithIntl(<DashboardOverview />);
    const table = await screen.findByRole("table", { name: "Top courses" });
    expect(within(table).getAllByRole("rowheader").map((h) => h.textContent)).toEqual([
      "Brand Design Basics",
      "Social Media Content That Sells",
    ]);
    expect(screen.getByRole("link", { name: "View all courses" })).toHaveAttribute("href", "/dashboard/courses");
  });

  it("shows no sales, zero students and an empty course list when the school has no courses", async () => {
    salesState.isEmpty = true;
    renderWithIntl(<DashboardOverview />);
    expect(await screen.findByText("No sales yet")).toBeInTheDocument();
    expect(statOf("Students")).toHaveTextContent("0");
    expect(statOf("Completion rate")).toHaveTextContent("0%");
    expect(screen.getByText("No courses yet")).toBeInTheDocument();
  });

  it("uses Khmer labels when the locale is km", async () => {
    renderWithIntl(<DashboardOverview />, { locale: "km" });
    expect(await screen.findByRole("heading", { level: 1, name: "ទិដ្ឋភាពទូទៅ" })).toBeInTheDocument();
    expect(screen.getByText("អត្រាបញ្ចប់")).toBeInTheDocument();
  });
});
