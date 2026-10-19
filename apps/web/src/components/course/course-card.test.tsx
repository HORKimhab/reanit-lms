import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";
import { PUBLISHED_COURSE } from "@/test/site";

import { CourseCard } from "./course-card";

describe("CourseCard", () => {
  it("links to the course's sales page on its school", async () => {
    renderWithIntl(<CourseCard course={PUBLISHED_COURSE} schoolSlug="angkor" instructorName="Dara Sok" />);
    expect(await screen.findByRole("link")).toHaveAttribute("href", "/s/angkor/courses/brand-design-basics");
  });

  it("shows the title, description and instructor", async () => {
    renderWithIntl(<CourseCard course={PUBLISHED_COURSE} schoolSlug="angkor" instructorName="Dara Sok" />);
    expect(await screen.findByText("Brand Design Basics")).toBeInTheDocument();
    expect(screen.getByText("Design a logo, palette and type system.")).toBeInTheDocument();
    expect(screen.getByText("Dara Sok")).toBeInTheDocument();
  });

  it("leaves out an empty description", async () => {
    renderWithIntl(<CourseCard course={{ ...PUBLISHED_COURSE, description: null }} schoolSlug="angkor" instructorName="Dara Sok" />);
    expect(await screen.findByRole("link")).toHaveTextContent(/^Brand Design BasicsDara Sok$/);
  });
});
