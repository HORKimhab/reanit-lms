import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SCHOOL_PAGE } from "@/test/admin";
import { renderWithIntl } from "@/test/render";

import { SchoolList } from "./school-list";

/**
 * Renders the list with action spies.
 *
 * @param result - The page of schools.
 * @param q - The search.
 */
function renderList(result = SCHOOL_PAGE, q?: string) {
  renderWithIntl(<SchoolList result={result} q={q} suspend={vi.fn()} unsuspend={vi.fn()} />);
}

describe("SchoolList", () => {
  it("shows each school's owner, plan in force and status, and pages through the search", async () => {
    renderList(SCHOOL_PAGE, "a");

    const rows = within(await screen.findByRole("table", { name: "Schools" })).getAllByRole("row");
    expect(rows.slice(1).map((row) => within(row).getAllByRole("cell").slice(0, 4).map((cell) => cell.textContent))).toEqual([
      ["sokha@example.com", "Pro until Nov 27, 2026", "Jan 5, 2026", "Online"],
      ["—", "Free", "Feb 10, 2026", "Suspended on Oct 20, 2026: Pirated courses"],
    ]);
    expect(within(rows[1]!).getByText("Suspend…")).toBeInTheDocument();
    expect(within(rows[2]!).getByRole("button", { name: "Bring back online" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next page" })).toHaveAttribute("href", "/admin/schools?q=a&page=2");
    expect(screen.getByRole("searchbox")).toHaveValue("a");
  });

  it("says when nothing matches the search", async () => {
    renderList({ ...SCHOOL_PAGE, schools: [], total: 0 }, "zzz");

    expect(await screen.findByText('No school matches "zzz".')).toBeInTheDocument();
  });
});
