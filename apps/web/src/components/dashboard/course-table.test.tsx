import type { Course } from "@reanit/core/catalog";
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import { CourseTable } from "./course-table";

const DRAFT: Course = { id: "c1", title: "Intro to Design", slug: "intro-to-design", description: null, status: "draft" };
const LIVE: Course = { id: "c2", title: "Brand Basics", slug: "brand-basics", description: "Logos", status: "published" };

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
  it("links each course to its builder and shows its status", async () => {
    renderWithIntl(<CourseTable caption="All courses" courses={[DRAFT, LIVE]} />);
    await screen.findByRole("table", { name: "All courses" });

    expect(within(rowOf("Intro to Design")).getByRole("link")).toHaveAttribute("href", "/dashboard/courses/intro-to-design");
    expect(within(rowOf("Intro to Design")).getByText("Draft")).toBeInTheDocument();
    expect(within(rowOf("Brand Basics")).getByText("Published")).toBeInTheDocument();
  });

  it("keeps the given row order", async () => {
    renderWithIntl(<CourseTable caption="All courses" courses={[LIVE, DRAFT]} />);
    const headers = await screen.findAllByRole("rowheader");
    expect(headers.map((h) => h.textContent)).toEqual(["Brand Basics", "Intro to Design"]);
  });

  it("shows an empty state instead of a table when there are no courses", async () => {
    renderWithIntl(<CourseTable caption="All courses" courses={[]} />);
    expect(await screen.findByText("No courses yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("uses Khmer headings and statuses when the locale is km", async () => {
    renderWithIntl(<CourseTable caption="វគ្គសិក្សាទាំងអស់" courses={[DRAFT]} />, { locale: "km" });
    expect(await screen.findByRole("columnheader", { name: "ស្ថានភាព" })).toBeInTheDocument();
    expect(screen.getByText("សេចក្តីព្រាង")).toBeInTheDocument();
  });
});
