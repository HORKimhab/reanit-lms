import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getMockCourses } from "@/mocks/courses";
import type * as Courses from "@/mocks/courses";
import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { renderRoute, routeProps } from "@/test/render";

import SchoolHome from "./page";

// The catalog stands in for the API, so a test can return an empty one.
vi.mock("@/mocks/courses", async (importOriginal) => {
  const actual = await importOriginal<typeof Courses>();
  return { ...actual, getMockCourses: vi.fn(actual.getMockCourses) };
});

describe("SchoolHome", () => {
  it("shows the school's name, tagline and a card per course", async () => {
    await renderRoute(<SchoolHome {...routeProps({ school: MOCK_SCHOOL_SLUG })} />);
    expect(await screen.findByRole("heading", { level: 1, name: "Angkor Academy" })).toBeInTheDocument();
    expect(screen.getByText("Practical courses for Cambodian creators.")).toBeInTheDocument();
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      `/s/${MOCK_SCHOOL_SLUG}/courses/brand-design-basics`,
      `/s/${MOCK_SCHOOL_SLUG}/courses/social-media-content`,
    ]);
  });

  it("says there are no courses when the catalog is empty", async () => {
    vi.mocked(getMockCourses).mockReturnValueOnce([]);
    await renderRoute(<SchoolHome {...routeProps({ school: MOCK_SCHOOL_SLUG })} />);
    expect(await screen.findByText("No courses yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
