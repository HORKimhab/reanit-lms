import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getMockCourseSales } from "@/mocks/sales";
import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { renderWithIntl } from "@/test/render";

import { CourseTable } from "./course-table";

const SALES = getMockCourseSales(MOCK_SCHOOL_SLUG);

/**
 * Finds a course's row by its title.
 *
 * @param title - The course title in the row header.
 * @returns The table row.
 */
function rowOf(title: string) {
  return screen.getByRole("rowheader", { name: title }).closest("tr") as HTMLElement;
}

describe("CourseTable", () => {
  it("shows each course's price, lessons, students and revenue in its own currency", async () => {
    renderWithIntl(<CourseTable caption="All courses" rows={SALES} />);
    await screen.findByRole("table", { name: "All courses" });
    const brand = within(rowOf("Brand Design Basics"));
    expect(brand.getByText("$49.00")).toBeInTheDocument();
    expect(brand.getByRole("cell", { name: "9" })).toBeInTheDocument();
    expect(brand.getByRole("cell", { name: "128" })).toBeInTheDocument();
    expect(brand.getByRole("cell", { name: "$6,272.00" })).toBeInTheDocument();
    expect(brand.getByRole("link", { name: "Brand Design Basics" })).toHaveAttribute(
      "href",
      "/dashboard/courses/brand-design-basics",
    );
    expect(within(rowOf("Social Media Content That Sells")).getByRole("cell", { name: "KHR\u00a06,480,000" })).toBeInTheDocument();
  });

  it("keeps the given row order", async () => {
    renderWithIntl(<CourseTable caption="All courses" rows={[...SALES].reverse()} />);
    const headers = await screen.findAllByRole("rowheader");
    expect(headers.map((h) => h.textContent)).toEqual(["Social Media Content That Sells", "Brand Design Basics"]);
  });

  it("shows an empty state instead of a table when there are no courses", async () => {
    renderWithIntl(<CourseTable caption="All courses" rows={[]} />);
    expect(await screen.findByText("No courses yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("uses Khmer column headings when the locale is km", async () => {
    renderWithIntl(<CourseTable caption="All courses" rows={SALES} />, { locale: "km" });
    expect(await screen.findByRole("columnheader", { name: "ចំណូល" })).toBeInTheDocument();
  });
});
