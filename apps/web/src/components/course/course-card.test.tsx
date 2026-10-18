import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getMockCourse, type MockCourse } from "@/mocks/courses";
import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { renderWithIntl } from "@/test/render";

import { CourseCard } from "./course-card";

const COURSE = getMockCourse(MOCK_SCHOOL_SLUG, "social-media-content") as MockCourse;

describe("CourseCard", () => {
  it("links to the course's sales page", async () => {
    renderWithIntl(<CourseCard course={COURSE} />);
    expect(await screen.findByRole("link")).toHaveAttribute("href", `/s/${MOCK_SCHOOL_SLUG}/courses/social-media-content`);
  });

  it("shows title, lesson count, total length and price", async () => {
    renderWithIntl(<CourseCard course={COURSE} />);
    expect(await screen.findByRole("heading", { name: COURSE.title })).toBeInTheDocument();
    expect(screen.getByText(/4 lessons/)).toHaveTextContent("Dara Sok · 4 lessons · 39 min");
    expect(screen.getByText("KHR 120,000")).toBeInTheDocument();
  });

  it("uses Khmer labels when the locale is km", async () => {
    renderWithIntl(<CourseCard course={COURSE} />, { locale: "km" });
    expect(await screen.findByText(/មេរៀន 4/)).toBeInTheDocument();
    expect(screen.getByText("120,000៛")).toBeInTheDocument();
  });
});
