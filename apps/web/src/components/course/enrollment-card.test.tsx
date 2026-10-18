import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getMockCourse, type MockCourse } from "@/mocks/courses";
import { toEnrollment } from "@/mocks/enrollments";
import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { renderWithIntl } from "@/test/render";

import { EnrollmentCard } from "./enrollment-card";

const COURSE = getMockCourse(MOCK_SCHOOL_SLUG, "social-media-content") as MockCourse;
const PLAYER_HREF = `/s/${MOCK_SCHOOL_SLUG}/learn/social-media-content`;

describe("EnrollmentCard", () => {
  it("offers to start when no lesson is done", async () => {
    renderWithIntl(<EnrollmentCard enrollment={toEnrollment(COURSE, 0)} />);
    expect(await screen.findByRole("link", { name: "Start course" })).toHaveAttribute("href", PLAYER_HREF);
  });

  it("offers to continue and shows progress when partly done", async () => {
    renderWithIntl(<EnrollmentCard enrollment={toEnrollment(COURSE, 1)} />);
    expect(await screen.findByRole("link", { name: "Continue" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Course progress" })).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByText("1 of 4 lessons · 25%")).toBeInTheDocument();
  });

  it("offers a review when the course is completed", async () => {
    renderWithIntl(<EnrollmentCard enrollment={toEnrollment(COURSE, 4)} />);
    expect(await screen.findByRole("link", { name: "Review course" })).toBeInTheDocument();
  });

  it("uses Khmer labels when the locale is km", async () => {
    renderWithIntl(<EnrollmentCard enrollment={toEnrollment(COURSE, 1)} />, { locale: "km" });
    expect(await screen.findByRole("link", { name: "បន្តរៀន" })).toBeInTheDocument();
  });
});
