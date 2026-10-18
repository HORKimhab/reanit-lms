import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getMockCourse, type MockCourse } from "@/mocks/courses";
import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { renderWithIntl } from "@/test/render";

import { CourseDetails } from "./course-details";

const COURSE = getMockCourse(MOCK_SCHOOL_SLUG, "brand-design-basics") as MockCourse;

describe("CourseDetails", () => {
  it("shows the course hero with level, instructor, lesson count and length", async () => {
    renderWithIntl(<CourseDetails course={COURSE} />);
    expect(await screen.findByRole("heading", { level: 1, name: "Brand Design Basics" })).toBeInTheDocument();
    expect(screen.getByText("Beginner")).toBeInTheDocument();
    expect(screen.getByText(/By Dara Sok/)).toHaveTextContent("By Dara Sok · 9 lessons · 1 h 38 min");
  });

  it("lists the curriculum by section with preview badges", async () => {
    renderWithIntl(<CourseDetails course={COURSE} />);
    const first = (await screen.findByText("Getting started")).closest("details") as HTMLElement;
    expect(within(first).getAllByRole("listitem")).toHaveLength(3);
    expect(within(first).getAllByText("Preview")).toHaveLength(2);
    expect(screen.getByText("Logo design")).toBeInTheDocument();
  });

  it("shows outcomes, instructor bio and FAQ", async () => {
    renderWithIntl(<CourseDetails course={COURSE} />);
    expect(await screen.findByText("Design a simple, memorable logo")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your instructor" })).toBeInTheDocument();
    expect(screen.getByText("How long do I have access?")).toBeInTheDocument();
  });

  it("offers enrollment in the desktop buy box and the mobile bar", async () => {
    renderWithIntl(<CourseDetails course={COURSE} />);
    expect(await screen.findAllByRole("button", { name: "Enroll now" })).toHaveLength(2);
    expect(screen.getAllByText("$49.00")).toHaveLength(2);
  });

  it("uses Khmer labels when the locale is km", async () => {
    renderWithIntl(<CourseDetails course={COURSE} />, { locale: "km" });
    expect(await screen.findAllByRole("button", { name: "ចុះឈ្មោះឥឡូវនេះ" })).toHaveLength(2);
  });
});
