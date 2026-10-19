import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";
import { STUDENTS } from "@/test/staff";

import { StudentTable } from "./student-table";

/**
 * Finds a student's row by the text of its row header.
 *
 * @param name - The student's name, or the no-name placeholder.
 * @returns The row's cells.
 */
function rowOf(name: string) {
  return within(screen.getByRole("rowheader", { name }).closest("tr") as HTMLElement);
}

describe("StudentTable", () => {
  it("shows each student's email, course counts and join date", async () => {
    renderWithIntl(<StudentTable rows={STUDENTS} />);
    await screen.findByRole("table", { name: "Students" });
    expect(rowOf("Sokha Chan").getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "sokha@example.com",
      "2",
      "1",
      "Mar 14, 2026",
    ]);
  });

  it("marks a student who gave no name", async () => {
    renderWithIntl(<StudentTable rows={STUDENTS} />);
    expect(await screen.findByRole("rowheader", { name: "No name" })).toBeInTheDocument();
    expect(rowOf("No name").getByRole("cell", { name: "dara.pich@example.com" })).toBeInTheDocument();
  });

  it("keeps the given row order", async () => {
    renderWithIntl(<StudentTable rows={STUDENTS.toReversed()} />);
    const names = (await screen.findAllByRole("rowheader")).map((h) => h.textContent);
    expect(names).toEqual(["Sokha Chan", "No name"]);
  });

  it("uses Khmer headings and dates when the locale is km", async () => {
    renderWithIntl(<StudentTable rows={STUDENTS} />, { locale: "km" });
    expect(await screen.findByRole("columnheader", { name: "ចូលរួមនៅ" })).toBeInTheDocument();
    const joined = rowOf("Sokha Chan").getAllByRole("cell").at(-1)?.textContent;
    expect(joined).toMatch(/2026/);
    expect(joined).not.toBe("Mar 14, 2026");
  });
});
