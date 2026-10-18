import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getMockCourse, type MockCourse } from "@/mocks/courses";
import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { setPathname } from "@/test/navigation";
import { renderWithIntl } from "@/test/render";

import { LessonList } from "./lesson-list";

const COURSE = getMockCourse(MOCK_SCHOOL_SLUG, "social-media-content") as MockCourse;
const BASE = `/s/${MOCK_SCHOOL_SLUG}/learn/social-media-content`;

describe("LessonList", () => {
  it("groups lessons under their section headings with player links", async () => {
    renderWithIntl(<LessonList course={COURSE} completedLessons={0} />);
    const planning = (await screen.findByRole("heading", { name: "Planning" })).closest("section") as HTMLElement;
    expect(within(planning).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([`${BASE}/1-1`, `${BASE}/1-2`]);
  });

  it("marks the current lesson as the current page", async () => {
    setPathname(`${BASE}/2-1`);
    renderWithIntl(<LessonList course={COURSE} completedLessons={0} />);
    expect(await screen.findByRole("link", { name: /Phone photography basics/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Who are you posting for/ })).not.toHaveAttribute("aria-current");
  });

  it("shows each lesson's running time", async () => {
    renderWithIntl(<LessonList course={COURSE} completedLessons={0} />);
    expect(await screen.findByRole("link", { name: /Phone photography basics/ })).toHaveTextContent("18 min");
  });
});
