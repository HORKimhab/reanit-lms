import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";
import { COURSE_STATS } from "@/test/stats";

import { CourseSalesTable } from "./course-sales-table";

/**
 * Finds a course's row by its title.
 *
 * @param title - The course title in the row header.
 * @returns The table row.
 */
function rowOf(title: string) {
  return screen.getByRole("rowheader", { name: title }).closest("tr") as HTMLElement;
}

describe("CourseSalesTable", () => {
  it("shows each course's students, completions and revenue per currency", async () => {
    renderWithIntl(<CourseSalesTable caption="All courses" rows={COURSE_STATS} />);
    await screen.findByRole("table", { name: "All courses" });
    const brand = within(rowOf("Brand Design Basics"));
    expect(brand.getByRole("cell", { name: "128" })).toBeInTheDocument();
    expect(brand.getByRole("cell", { name: "41" })).toBeInTheDocument();
    expect(brand.getByText("KHR 6,480,000")).toBeInTheDocument();
    expect(brand.getByText("$6,272.00")).toBeInTheDocument();
    expect(brand.getByRole("link", { name: "Brand Design Basics" })).toHaveAttribute(
      "href",
      "/dashboard/courses/brand-design-basics",
    );
  });

  it("shows no sales for a course that was never sold", async () => {
    renderWithIntl(<CourseSalesTable caption="All courses" rows={COURSE_STATS} />);
    await screen.findByRole("table", { name: "All courses" });
    expect(within(rowOf("Photography 101")).getByRole("cell", { name: "No sales yet" })).toBeInTheDocument();
  });

  it("keeps the given row order", async () => {
    renderWithIntl(<CourseSalesTable caption="All courses" rows={COURSE_STATS.toReversed()} />);
    const headers = await screen.findAllByRole("rowheader");
    expect(headers.map((h) => h.textContent)).toEqual([
      "Photography 101",
      "Social Media Content That Sells",
      "Brand Design Basics",
    ]);
  });

  it("shows an empty state instead of a table when there are no courses", async () => {
    renderWithIntl(<CourseSalesTable caption="All courses" rows={[]} />);
    expect(await screen.findByText("No courses yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("uses Khmer column headings when the locale is km", async () => {
    renderWithIntl(<CourseSalesTable caption="All courses" rows={COURSE_STATS} />, { locale: "km" });
    expect(await screen.findByRole("columnheader", { name: "ការបញ្ចប់" })).toBeInTheDocument();
  });
});
