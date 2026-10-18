import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import DashboardCourses from "./page";

describe("DashboardCourses", () => {
  it("lists every course in the school, most students first", async () => {
    renderWithIntl(<DashboardCourses />);
    expect(await screen.findByRole("heading", { level: 1, name: "Courses" })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "All courses" });
    expect(within(table).getAllByRole("rowheader").map((h) => h.textContent)).toEqual([
      "Brand Design Basics",
      "Social Media Content That Sells",
    ]);
  });

  it("uses the Khmer heading when the locale is km", async () => {
    renderWithIntl(<DashboardCourses />, { locale: "km" });
    expect(await screen.findByRole("heading", { level: 1, name: "វគ្គសិក្សា" })).toBeInTheDocument();
  });
});
