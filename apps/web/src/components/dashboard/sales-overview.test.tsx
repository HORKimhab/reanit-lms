import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";
import { COURSE_STATS } from "@/test/stats";

import { SalesOverview } from "./sales-overview";

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
    renderWithIntl(<SalesOverview stats={COURSE_STATS} />);
    expect(await screen.findByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
    const revenue = within(statOf("Revenue"));
    expect(revenue.getByText("KHR 6,480,000")).toBeInTheDocument();
    expect(revenue.getByText("$7,622.00")).toBeInTheDocument();
    expect(statOf("Students")).toHaveTextContent("182");
    expect(statOf("Completion rate")).toHaveTextContent("35%");
  });

  it("lists the top three courses and links to the full course list", async () => {
    // COURSE_STATS is a fixed three-course fixture, so its first entry exists.
    const fourth = { ...COURSE_STATS[0]!, courseId: "3c4d5e6f-7a8b-4c3d-8e4f-5a6b7c8d9e0f", title: "Extra", slug: "extra" };
    renderWithIntl(<SalesOverview stats={[...COURSE_STATS, fourth]} />);
    const table = await screen.findByRole("table", { name: "Top courses" });
    expect(within(table).getAllByRole("rowheader").map((h) => h.textContent)).toEqual([
      "Brand Design Basics",
      "Social Media Content That Sells",
      "Photography 101",
    ]);
    expect(screen.getByRole("link", { name: "View all courses" })).toHaveAttribute("href", "/dashboard/courses");
  });

  it("shows no sales, zero students and an empty course list when the school has no courses", async () => {
    renderWithIntl(<SalesOverview stats={[]} />);
    expect(await screen.findByText("No sales yet")).toBeInTheDocument();
    expect(statOf("Students")).toHaveTextContent("0");
    expect(statOf("Completion rate")).toHaveTextContent("0%");
    expect(screen.getByText("No courses yet")).toBeInTheDocument();
  });

  it("uses Khmer labels when the locale is km", async () => {
    renderWithIntl(<SalesOverview stats={COURSE_STATS} />, { locale: "km" });
    expect(await screen.findByRole("heading", { level: 1, name: "ទិដ្ឋភាពទូទៅ" })).toBeInTheDocument();
    expect(screen.getByText("អត្រាបញ្ចប់")).toBeInTheDocument();
  });
});
