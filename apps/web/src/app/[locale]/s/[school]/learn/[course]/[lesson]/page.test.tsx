// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { onApi, requestTo } from "@/test/api";
import { NotFoundError } from "@/test/navigation";
import { PLAYER_COURSE, STUDENT_QUIZ } from "@/test/player";
import { routeProps } from "@/test/render";

import LessonPage from "./page";

vi.mock("next/headers", () => import("@/test/headers"));

// The page only composes LessonView, which has its own tests; its not-found and quiz branches are tested here.
describe("LessonPage", () => {
  it("404s when the course has no such lesson", async () => {
    onApi("GET /schools/by-subdomain/angkor/learn/brand-design-basics", Response.json({ course: PLAYER_COURSE }));

    const props = routeProps({ school: "angkor", course: "brand-design-basics", lesson: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0aff" });
    await expect(LessonPage(props)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("loads a quiz lesson's quiz for the student, and no file", async () => {
    const [section] = PLAYER_COURSE.sections;
    const quizLesson = { ...section!.lessons[1]!, type: "quiz" as const };
    const course = { ...PLAYER_COURSE, sections: [{ ...section!, lessons: [section!.lessons[0]!, quizLesson] }, ...PLAYER_COURSE.sections.slice(1)] };
    onApi("GET /schools/by-subdomain/angkor/learn/brand-design-basics", Response.json({ course }));
    onApi(`GET /schools/by-subdomain/angkor/lessons/${quizLesson.id}/quiz`, Response.json({ quiz: STUDENT_QUIZ }));

    const page = await LessonPage(routeProps({ school: "angkor", course: "brand-design-basics", lesson: quizLesson.id }));

    expect(page.props.quiz.view).toEqual(STUDENT_QUIZ);
    expect(requestTo(`GET /schools/by-subdomain/angkor/lessons/${quizLesson.id}/media`)).toBeUndefined();
  });

  it("loads nothing for a drip lesson that has not opened", async () => {
    const [section] = PLAYER_COURSE.sections;
    const lesson = { ...section!.lessons[0]!, unlockAt: "2999-01-01T00:00:00.000Z" };
    const course = { ...PLAYER_COURSE, sections: [{ ...section!, lessons: [lesson, ...section!.lessons.slice(1)] }, ...PLAYER_COURSE.sections.slice(1)] };
    onApi("GET /schools/by-subdomain/angkor/learn/brand-design-basics", Response.json({ course }));

    const page = await LessonPage(routeProps({ school: "angkor", course: "brand-design-basics", lesson: lesson.id }));

    expect(page.props.lesson.lockedUntil).toEqual(new Date("2999-01-01T00:00:00.000Z"));
    expect(page.props.fileUrl).toBeNull();
    expect(requestTo(`GET /schools/by-subdomain/angkor/lessons/${lesson.id}/media`)).toBeUndefined();
  });
});
