import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { getMockStudents } from "@/mocks/students";
import { renderWithIntl } from "@/test/render";

import { StudentTable } from "./student-table";

const STUDENTS = getMockStudents(MOCK_SCHOOL_SLUG);

describe("StudentTable", () => {
  it("shows each student's email, course counts and join date", async () => {
    renderWithIntl(<StudentTable rows={STUDENTS} />);
    await screen.findByRole("table", { name: "Students" });
    const sokha = within(screen.getByRole("rowheader", { name: "Sokha Chan" }).closest("tr") as HTMLElement);
    expect(sokha.getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "sokha@example.com",
      "2",
      "1",
      "Mar 14, 2026",
    ]);
  });

  it("keeps the given row order", async () => {
    renderWithIntl(<StudentTable rows={STUDENTS} />);
    const names = (await screen.findAllByRole("rowheader")).map((h) => h.textContent);
    expect(names).toEqual(["Dara Pich", "Vanna Lim", "Sokha Chan"]);
  });

  it("shows an empty state instead of a table when there are no students", async () => {
    renderWithIntl(<StudentTable rows={[]} />);
    expect(await screen.findByText("No students yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("uses Khmer headings and dates when the locale is km", async () => {
    renderWithIntl(<StudentTable rows={STUDENTS} />, { locale: "km" });
    expect(await screen.findByRole("columnheader", { name: "ចូលរួមនៅ" })).toBeInTheDocument();
    const sokha = within(screen.getByRole("rowheader", { name: "Sokha Chan" }).closest("tr") as HTMLElement);
    expect(sokha.getAllByRole("cell").at(-1)?.textContent).toMatch(/2026/);
    expect(sokha.getAllByRole("cell").at(-1)?.textContent).not.toBe("Mar 14, 2026");
  });
});
