import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";
import { PUBLISHED_COURSE_WITH_OUTLINE as COURSE } from "@/test/site";

import { CourseDetails } from "./course-details";

describe("CourseDetails", () => {
  it("shows the course hero with description, instructor, lesson count and length", async () => {
    renderWithIntl(<CourseDetails course={COURSE} instructorName="Dara Sok" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Brand Design Basics" })).toBeInTheDocument();
    expect(screen.getByText("Design a logo, palette and type system.")).toBeInTheDocument();
    expect(screen.getByText(/By Dara Sok/)).toHaveTextContent("By Dara Sok · 3 lessons · 1 h 35 min");
  });

  it("lists the curriculum by section", async () => {
    renderWithIntl(<CourseDetails course={COURSE} instructorName="Dara Sok" />);
    const first = (await screen.findByText("Getting started")).closest("details") as HTMLElement;
    expect(within(first).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Sketching")).toBeInTheDocument();
  });

  it("names the instructor in their own section", async () => {
    renderWithIntl(<CourseDetails course={COURSE} instructorName="Dara Sok" />);
    const heading = await screen.findByRole("heading", { name: "Your instructor" });
    expect(heading.parentElement).toHaveTextContent("Dara Sok");
  });

  it("leaves out the description when there is none", async () => {
    renderWithIntl(<CourseDetails course={{ ...COURSE, description: null }} instructorName="Dara Sok" />);
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading.nextElementSibling).toHaveTextContent(/^By Dara Sok/);
  });

  it("offers enrollment in the desktop buy box and the mobile bar", async () => {
    renderWithIntl(<CourseDetails course={COURSE} instructorName="Dara Sok" />);
    expect(await screen.findAllByRole("button", { name: "Enroll now" })).toHaveLength(2);
  });

  it("uses Khmer labels when the locale is km", async () => {
    renderWithIntl(<CourseDetails course={COURSE} instructorName="Dara Sok" />, { locale: "km" });
    expect(await screen.findAllByRole("button", { name: "ចុះឈ្មោះឥឡូវនេះ" })).toHaveLength(2);
  });
});
