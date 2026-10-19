import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CourseOgImage } from "./course-og-image";

describe("CourseOgImage", () => {
  it("shows the school, the course title and the details", () => {
    render(<CourseOgImage title="Brand Design Basics" schoolName="Angkor Academy" details="3 lessons" brand="#0055aa" />);

    expect(screen.getByText("Angkor Academy")).toHaveStyle({ color: "#0055aa" });
    expect(screen.getByText("Brand Design Basics")).toBeInTheDocument();
    expect(screen.getByText("3 lessons")).toBeInTheDocument();
  });
});
