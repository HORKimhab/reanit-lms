// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { NotFoundError, RedirectError } from "@/test/navigation";
import { STUDENT_QUIZ } from "@/test/player";
import { signIn } from "@/test/session";

import { getStaffQuiz, getStudentQuiz } from "./quizzes";

vi.mock("next/headers", () => import("@/test/headers"));

const LESSON_ID = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a60";
const STUDENT_ROUTE = `GET /schools/by-subdomain/angkor/lessons/${LESSON_ID}/quiz`;

beforeEach(() => {
  signIn();
});

describe("getStaffQuiz", () => {
  it("loads the quiz with its right answers, and 404s on a lesson that is not a quiz", async () => {
    const quiz = { passPercent: 70, questions: [] };
    onApi(`GET /lessons/${LESSON_ID}/quiz`, Response.json({ quiz }));

    expect(await getStaffQuiz(LESSON_ID)).toEqual(quiz);
    onApi(`GET /lessons/${LESSON_ID}/quiz`, problem(404, "urn:reanit:problem:quiz-not-found"));
    await expect(getStaffQuiz(LESSON_ID)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("getStudentQuiz", () => {
  it("loads the quiz for its student", async () => {
    onApi(STUDENT_ROUTE, Response.json({ quiz: STUDENT_QUIZ }));

    expect(await getStudentQuiz("angkor", LESSON_ID, "/s/angkor/learn/brand/l")).toEqual(STUDENT_QUIZ);
  });

  it("returns null while the quiz has no questions", async () => {
    onApi(STUDENT_ROUTE, problem(404, "urn:reanit:problem:quiz-not-found"));

    expect(await getStudentQuiz("angkor", LESSON_ID, "/s/angkor/learn/brand/l")).toBeNull();
  });

  it("sends a signed-out student to log in and back to the lesson", async () => {
    onApi(STUDENT_ROUTE, problem(401));

    await expect(getStudentQuiz("angkor", LESSON_ID, "/s/angkor/learn/brand/l")).rejects.toEqual(new RedirectError("/login?next=%2Fs%2Fangkor%2Flearn%2Fbrand%2Fl"));
  });
});
