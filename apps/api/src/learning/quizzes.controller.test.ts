import { QuizNotFoundError } from "@reanit/core/learning";
import { describe, expect, it } from "vitest";

import { TEST_SCHOOL, useStaffApp } from "../test/session";

const LESSON_ID = "3c2b1a09-8f7e-4d6c-9b5a-4e3d2c1b0a77";
const QUIZ = {
  passPercent: 80,
  questions: [
    {
      id: "3c2b1a09-8f7e-4d6c-9b5a-4e3d2c1b0a01",
      prompt: "Pick red",
      kind: "single",
      options: [
        { id: "3c2b1a09-8f7e-4d6c-9b5a-4e3d2c1b0a02", text: "Red", isCorrect: true },
        { id: "3c2b1a09-8f7e-4d6c-9b5a-4e3d2c1b0a03", text: "Blue", isCorrect: false },
      ],
    },
  ],
};
const staff = useStaffApp();

describe("quiz builder routes", () => {
  it("loads a quiz lesson with its right answers from the caller's school", async () => {
    staff.clients.learning.getQuizForEditing.mockResolvedValue(QUIZ);

    const response = await staff.app.inject({ method: "GET", url: `/lessons/${LESSON_ID}/quiz`, headers: staff.headers });

    expect(response.json()).toEqual({ quiz: QUIZ });
    expect(staff.clients.learningFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
  });

  it("saves the quiz and answers 204", async () => {
    const response = await staff.app.inject({ method: "PUT", url: `/lessons/${LESSON_ID}/quiz`, headers: staff.headers, payload: QUIZ });

    expect(response.statusCode).toBe(204);
    expect(staff.clients.learning.saveQuiz).toHaveBeenCalledWith(LESSON_ID, QUIZ);
  });

  it("answers 400 for a single-answer question with two right options", async () => {
    const [question] = QUIZ.questions;
    const payload = { ...QUIZ, questions: [{ ...question, options: question?.options.map((option) => ({ ...option, isCorrect: true })) }] };

    const response = await staff.app.inject({ method: "PUT", url: `/lessons/${LESSON_ID}/quiz`, headers: staff.headers, payload });

    expect(response.statusCode).toBe(400);
    expect(staff.clients.learning.saveQuiz).not.toHaveBeenCalled();
  });

  it("answers 404 quiz-not-found for a lesson that is not a quiz", async () => {
    staff.clients.learning.getQuizForEditing.mockRejectedValue(new QuizNotFoundError());

    const response = await staff.app.inject({ method: "GET", url: `/lessons/${LESSON_ID}/quiz`, headers: staff.headers });

    expect(response.json()).toMatchObject({ status: 404, type: "urn:reanit:problem:quiz-not-found" });
  });
});
