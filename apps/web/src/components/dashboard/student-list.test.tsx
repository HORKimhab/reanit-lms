import type { StudentPage } from "@reanit/core/schools";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";
import { STUDENTS } from "@/test/staff";

import { StudentList } from "./student-list";

/**
 * Builds a page of the students list.
 *
 * @param page - Overrides for the page.
 * @returns The page: both test students, 50 per page.
 */
function pageOf(page: Partial<StudentPage> = {}): StudentPage {
  return { students: STUDENTS, total: STUDENTS.length, page: 1, pageSize: 50, ...page };
}

describe("StudentList", () => {
  it("shows the students with a search box that keeps the current search", async () => {
    renderWithIntl(<StudentList result={pageOf()} q="sokha" />);
    expect(await screen.findByRole("table", { name: "Students" })).toBeInTheDocument();
    const search = screen.getByRole("searchbox", { name: "Search students" });
    expect(search).toHaveValue("sokha");
    expect(search).toHaveAttribute("name", "q");
    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute("type", "submit");
  });

  it("shows one page without page links when everyone fits", async () => {
    renderWithIntl(<StudentList result={pageOf()} />);
    const pages = await screen.findByRole("navigation", { name: "Students pages" });
    expect(pages).toHaveTextContent("Page 1 of 1");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("links to the pages around a middle page, keeping the search", async () => {
    renderWithIntl(<StudentList result={pageOf({ total: 120, page: 2 })} q="sokha" />);
    expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous page" })).toHaveAttribute("href", "/dashboard/students?q=sokha&page=1");
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute("href", "/dashboard/students?q=sokha&page=3");
  });

  it("offers no next page on the last page", async () => {
    renderWithIntl(<StudentList result={pageOf({ total: 100, page: 2 })} />);
    expect(await screen.findByRole("link", { name: "Previous page" })).toHaveAttribute("href", "/dashboard/students?page=1");
    expect(screen.queryByRole("link", { name: "Next page" })).not.toBeInTheDocument();
  });

  it("says no student matches a search that found nobody", async () => {
    renderWithIntl(<StudentList result={pageOf({ students: [], total: 0 })} q="zzz" />);
    expect(await screen.findByText("No students found")).toBeInTheDocument();
    expect(screen.getByText("No student's name or email contains “zzz”.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows an empty state when the school has no students yet", async () => {
    renderWithIntl(<StudentList result={pageOf({ students: [], total: 0 })} />);
    expect(await screen.findByText("No students yet")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Students pages" })).not.toBeInTheDocument();
  });

  it("uses Khmer labels when the locale is km", async () => {
    renderWithIntl(<StudentList result={pageOf()} />, { locale: "km" });
    expect(await screen.findByRole("searchbox", { name: "ស្វែងរកសិស្ស" })).toBeInTheDocument();
  });
});
