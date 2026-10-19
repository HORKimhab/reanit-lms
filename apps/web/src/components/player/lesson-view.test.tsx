import type { PlayerLesson } from "@reanit/core/learning";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PLAYER_BASE, PLAYER_LESSONS, STUDENT_QUIZ } from "@/test/player";
import { renderWithIntl } from "@/test/render";

import { LessonView } from "./lesson-view";

const [welcome, workbook, sketching] = PLAYER_LESSONS as [PlayerLesson, PlayerLesson, PlayerLesson];
const TEXT_LESSON: PlayerLesson = { ...workbook, type: "text", hasMedia: false };
const QUIZ_LESSON: PlayerLesson = { ...workbook, type: "quiz", hasMedia: false, isCompleted: false };
const NEXT_HREF = `${PLAYER_BASE}/next`;

/**
 * Renders a lesson of the test course.
 *
 * @param lesson - The lesson to show.
 * @param options - Render options.
 * @param options.fileUrl - Its signed file URL.
 * @param options.isQuiz - Whether it is a quiz lesson, given the test quiz.
 * @param options.locale - UI locale.
 * @returns The complete action spy.
 */
function renderLesson(
  lesson: PlayerLesson,
  { fileUrl = null, isQuiz = false, locale = "en" }: { fileUrl?: string | null; isQuiz?: boolean; locale?: "en" | "km" } = {},
) {
  const complete = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  renderWithIntl(
    <LessonView
      lessons={PLAYER_LESSONS}
      lesson={lesson}
      base={PLAYER_BASE}
      fileUrl={fileUrl}
      quiz={isQuiz ? { view: STUDENT_QUIZ, submit: vi.fn() } : null}
      nextHref={NEXT_HREF}
      savePosition={vi.fn()}
      complete={complete}
    />,
    { locale },
  );
  return complete;
}

describe("LessonView", () => {
  it("shows the lesson title and where it sits in the course", async () => {
    renderLesson(workbook);

    expect(await screen.findByRole("heading", { level: 1, name: "Workbook" })).toBeInTheDocument();
    expect(screen.getByText("Lesson 2 of 3 · Getting started")).toBeInTheDocument();
  });

  it("links to the previous lesson and completes this one to continue", async () => {
    const user = userEvent.setup();
    const complete = renderLesson(workbook);

    expect(await screen.findByRole("link", { name: "Previous" })).toHaveAttribute("href", `${PLAYER_BASE}/${welcome.id}`);
    await user.click(screen.getByRole("button", { name: "Complete and continue" }));

    expect(complete).toHaveBeenCalledOnce();
  });

  it("has no previous link on the first lesson", async () => {
    renderLesson(welcome, { fileUrl: "https://storage.test/welcome.mp4" });

    await screen.findByRole("button", { name: "Complete and continue" });
    expect(screen.queryByRole("link", { name: "Previous" })).not.toBeInTheDocument();
  });

  it("finishes the course on the last lesson", async () => {
    renderLesson(sketching, { fileUrl: "https://storage.test/sketching.mp4" });

    expect(await screen.findByRole("button", { name: "Finish course" })).toBeInTheDocument();
  });

  it("plays a video lesson from its signed URL", async () => {
    renderLesson(sketching, { fileUrl: "https://storage.test/sketching.mp4" });

    expect(await screen.findByLabelText("Sketching")).toHaveAttribute("src", "https://storage.test/sketching.mp4");
  });

  it("offers a PDF lesson's file for download", async () => {
    renderLesson(workbook, { fileUrl: "https://storage.test/workbook.pdf" });

    expect(await screen.findByRole("link", { name: "Download" })).toHaveAttribute("href", "https://storage.test/workbook.pdf");
  });

  it("says when a lesson's file is not ready yet", async () => {
    renderLesson(workbook);

    expect(await screen.findByText("This lesson's file is not ready yet. Check back soon.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Download" })).not.toBeInTheDocument();
  });

  it("shows the lesson text for a text lesson", async () => {
    renderLesson(TEXT_LESSON);

    expect(await screen.findByText("The lesson text written by the instructor appears here.")).toBeInTheDocument();
  });

  it("uses Khmer labels when the locale is km", async () => {
    renderLesson(workbook, { locale: "km" });

    expect(await screen.findByText("មេរៀនទី 2 នៃ 3 · Getting started")).toBeInTheDocument();
  });

  it("shows a quiz lesson's questions and holds back moving on until it is passed", async () => {
    renderLesson(QUIZ_LESSON, { isQuiz: true });

    expect(await screen.findByRole("group", { name: "Which color is primary?" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete and continue" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Continue" })).not.toBeInTheDocument();
  });

  it("lets the student continue from a quiz lesson they passed", async () => {
    renderLesson({ ...QUIZ_LESSON, isCompleted: true }, { isQuiz: true });

    expect(await screen.findByRole("link", { name: "Continue" })).toHaveAttribute("href", NEXT_HREF);
  });

  it("shows when a drip lesson opens instead of its content, with nothing to complete", async () => {
    renderLesson({ ...TEXT_LESSON, lockedUntil: new Date("2026-11-05T09:00:00Z") });

    expect(await screen.findByText("This lesson opens on November 5, 2026 at 9:00 AM.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Complete and continue" })).not.toBeInTheDocument();
  });
});
