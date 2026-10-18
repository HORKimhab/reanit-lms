import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MOCK_SCHOOL_SLUG } from "@/mocks/schools";
import { NotFoundError } from "@/test/navigation";
import { renderError, renderRoute, routeProps } from "@/test/render";

import LessonPage from "./page";

const BASE = `/s/${MOCK_SCHOOL_SLUG}/learn/brand-design-basics`;

/**
 * Renders a lesson of the Brand Design Basics course.
 *
 * @param lesson - The lesson id, such as "2-1".
 * @param locale - UI locale.
 * @returns Testing Library's render result.
 */
async function renderLesson(lesson: string, locale: "en" | "km" = "en") {
  const props = routeProps({ school: MOCK_SCHOOL_SLUG, course: "brand-design-basics", lesson });
  return renderRoute(<LessonPage {...props} />, { locale });
}

describe("LessonPage", () => {
  it("shows the lesson title and where it sits in the course", async () => {
    await renderLesson("2-2");
    expect(await screen.findByRole("heading", { level: 1, name: "Sketching ideas fast" })).toBeInTheDocument();
    expect(screen.getByText("Lesson 5 of 9 · Logo design")).toBeInTheDocument();
  });

  it("links to the previous and next lessons", async () => {
    await renderLesson("2-2");
    expect(await screen.findByRole("link", { name: "Previous" })).toHaveAttribute("href", `${BASE}/2-1`);
    expect(screen.getByRole("link", { name: "Complete and continue" })).toHaveAttribute("href", `${BASE}/2-3`);
  });

  it("has no previous link on the first lesson", async () => {
    await renderLesson("1-1");
    await screen.findByRole("link", { name: "Complete and continue" });
    expect(screen.queryByRole("link", { name: "Previous" })).not.toBeInTheDocument();
  });

  it("finishes back to my courses on the last lesson", async () => {
    await renderLesson("3-3");
    expect(await screen.findByRole("link", { name: "Finish course" })).toHaveAttribute("href", `/s/${MOCK_SCHOOL_SLUG}/my-courses`);
  });

  it("offers a download for a PDF lesson", async () => {
    await renderLesson("1-3");
    expect(await screen.findByRole("button", { name: "Download" })).toBeInTheDocument();
    expect(screen.getByText("Course workbook.pdf")).toBeInTheDocument();
  });

  it("shows the lesson text for a text lesson", async () => {
    await renderLesson("3-3");
    expect(await screen.findByText("The lesson text written by the instructor appears here.")).toBeInTheDocument();
  });

  it("shows the running time on a video lesson", async () => {
    await renderLesson("2-2");
    expect(await screen.findByText("16 min")).toBeInTheDocument();
  });

  it("uses Khmer labels when the locale is km", async () => {
    await renderLesson("2-2", "km");
    expect(await screen.findByText("មេរៀនទី 5 នៃ 9 · Logo design")).toBeInTheDocument();
  });

  it("404s when the lesson does not exist", async () => {
    const props = routeProps({ school: MOCK_SCHOOL_SLUG, course: "brand-design-basics", lesson: "9-9" });
    await expect(renderError(<LessonPage {...props} />)).resolves.toBeInstanceOf(NotFoundError);
  });

  it("404s when the student is not enrolled", async () => {
    const props = routeProps({ school: MOCK_SCHOOL_SLUG, course: "no-such-course", lesson: "1-1" });
    await expect(renderError(<LessonPage {...props} />)).resolves.toBeInstanceOf(NotFoundError);
  });
});
