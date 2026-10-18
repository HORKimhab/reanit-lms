import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getMockEnrollment, type MockEnrollment } from "@/mocks/enrollments";
import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { renderWithIntl } from "@/test/render";

import { PlayerShell } from "./player-shell";

const ENROLLMENT = getMockEnrollment(MOCK_SCHOOL_SLUG, "brand-design-basics") as MockEnrollment;

describe("PlayerShell", () => {
  it("shows the course title, progress and a way back to my courses", async () => {
    renderWithIntl(
      <PlayerShell school={MOCK_SCHOOL_SLUG} enrollment={ENROLLMENT}>
        Lesson body
      </PlayerShell>,
    );
    expect(await screen.findByText("Brand Design Basics")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Course progress" })).toHaveAttribute("aria-valuenow", "44");
    expect(screen.getByRole("link", { name: "Back to my courses" })).toHaveAttribute("href", `/s/${MOCK_SCHOOL_SLUG}/my-courses`);
    expect(screen.getByRole("main")).toHaveTextContent("Lesson body");
  });

  it("shows the outline in the desktop sidebar and the mobile drawer", async () => {
    renderWithIntl(<PlayerShell school={MOCK_SCHOOL_SLUG} enrollment={ENROLLMENT}>{null}</PlayerShell>);
    expect(await screen.findAllByRole("link", { name: /Reading the brief/ })).toHaveLength(2);
    expect(screen.getByText("Course content · 44% complete")).toBeInTheDocument();
  });
});
