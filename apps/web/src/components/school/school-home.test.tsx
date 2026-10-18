import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getMockCourses } from "@/mocks/courses";
import { MOCK_SCHOOL_SLUG, requireMockSchool } from "@/mocks/schools";
import { renderWithIntl } from "@/test/render";

import { SchoolHome } from "./school-home";

const SCHOOL = requireMockSchool(MOCK_SCHOOL_SLUG);

describe("SchoolHome", () => {
  it("shows the school's name, tagline and a card per course", async () => {
    renderWithIntl(<SchoolHome school={SCHOOL} courses={getMockCourses(MOCK_SCHOOL_SLUG)} />);
    expect(await screen.findByRole("heading", { level: 1, name: "Angkor Academy" })).toBeInTheDocument();
    expect(screen.getByText("Practical courses for Cambodian creators.")).toBeInTheDocument();
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      `/s/${MOCK_SCHOOL_SLUG}/courses/brand-design-basics`,
      `/s/${MOCK_SCHOOL_SLUG}/courses/social-media-content`,
    ]);
  });

  it("says there are no courses when the catalog is empty", async () => {
    renderWithIntl(<SchoolHome school={SCHOOL} courses={[]} />);
    expect(await screen.findByText("No courses yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("uses the Khmer catalog heading when the locale is km", async () => {
    renderWithIntl(<SchoolHome school={SCHOOL} courses={[]} />, { locale: "km" });
    expect(await screen.findByRole("heading", { level: 2, name: "វគ្គសិក្សា" })).toBeInTheDocument();
  });
});
