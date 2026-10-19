import { describe, expect, it } from "vitest";

import { gradeQuiz, quizAnswersSchema, quizSchema, toStudentQuiz, type Quiz } from "./quizzes";

/**
 * Builds a fixed UUID numbered for the test, so options and questions read apart.
 *
 * @param n A number from 0 to 99.
 * @returns The UUID.
 */
function ID(n: number) {
  return `0b9a6d1e-5c3f-4a2b-9e8d-7c6b5a4f3e${String(n).padStart(2, "0")}`;
}

/** A two-question quiz: one single-answer, one multiple-answer, passed at 50%. */
const QUIZ: Quiz = {
  passPercent: 50,
  questions: [
    {
      id: ID(1),
      prompt: "Pick the primary color",
      kind: "single",
      options: [
        { id: ID(11), text: "Red", isCorrect: true },
        { id: ID(12), text: "Green", isCorrect: false },
      ],
    },
    {
      id: ID(2),
      prompt: "Pick the warm colors",
      kind: "multiple",
      options: [
        { id: ID(21), text: "Red", isCorrect: true },
        { id: ID(22), text: "Orange", isCorrect: true },
        { id: ID(23), text: "Blue", isCorrect: false },
      ],
    },
  ],
};

describe("gradeQuiz", () => {
  it("passes a student who picks exactly the right options", () => {
    expect(
      gradeQuiz(QUIZ, [
        { questionId: ID(1), optionIds: [ID(11)] },
        { questionId: ID(2), optionIds: [ID(22), ID(21)] },
      ]),
    ).toEqual({ scorePercent: 100, isPassed: true, questions: [{ questionId: ID(1), isCorrect: true }, { questionId: ID(2), isCorrect: true }] });
  });

  it.each([
    ["only some of the right options", [ID(21)]],
    ["a wrong option with the right ones", [ID(21), ID(22), ID(23)]],
    ["an option of another question", [ID(21), ID(22), ID(11)]],
  ])("counts a multiple-answer question wrong for %s", (_case, optionIds) => {
    expect(gradeQuiz(QUIZ, [{ questionId: ID(2), optionIds }]).questions[1]?.isCorrect).toBe(false);
  });

  it("passes at exactly the pass mark and counts unanswered questions wrong", () => {
    expect(gradeQuiz(QUIZ, [{ questionId: ID(1), optionIds: [ID(11)] }])).toMatchObject({ scorePercent: 50, isPassed: true });
    expect(gradeQuiz({ ...QUIZ, passPercent: 51 }, [{ questionId: ID(1), optionIds: [ID(11)] }]).isPassed).toBe(false);
  });

  it("rounds the score to a whole percent", () => {
    const three = { ...QUIZ, questions: [...QUIZ.questions, { ...QUIZ.questions[0]!, id: ID(3) }] };

    expect(
      gradeQuiz(three, [
        { questionId: ID(1), optionIds: [ID(11)] },
        { questionId: ID(3), optionIds: [ID(11)] },
      ]).scorePercent,
    ).toBe(67);
  });
});

describe("toStudentQuiz", () => {
  it("keeps the prompts and options but not which options are right", () => {
    expect(JSON.stringify(toStudentQuiz(QUIZ))).not.toContain("isCorrect");
    expect(toStudentQuiz(QUIZ).questions[1]?.options).toEqual([
      { id: ID(21), text: "Red" },
      { id: ID(22), text: "Orange" },
      { id: ID(23), text: "Blue" },
    ]);
  });
});

describe("quizSchema", () => {
  it("accepts the quiz", () => {
    expect(quizSchema.parse(QUIZ)).toEqual(QUIZ);
  });

  it.each([
    ["a single-answer question with two right options", { ...QUIZ.questions[0]!, options: QUIZ.questions[0]!.options.map((option) => ({ ...option, isCorrect: true })) }],
    ["a question with no right option", { ...QUIZ.questions[1]!, options: QUIZ.questions[1]!.options.map((option) => ({ ...option, isCorrect: false })) }],
    ["a question with one option", { ...QUIZ.questions[0]!, options: QUIZ.questions[0]!.options.slice(0, 1) }],
    ["a blank prompt", { ...QUIZ.questions[0]!, prompt: " " }],
  ])("rejects %s", (_case, question) => {
    expect(quizSchema.safeParse({ ...QUIZ, questions: [question] }).success).toBe(false);
  });

  it("rejects a pass mark outside 1 to 100", () => {
    expect(quizSchema.safeParse({ ...QUIZ, passPercent: 0 }).success).toBe(false);
    expect(quizSchema.safeParse({ ...QUIZ, passPercent: 101 }).success).toBe(false);
  });
});

describe("quizAnswersSchema", () => {
  it("rejects option ids that are not UUIDs", () => {
    expect(quizAnswersSchema.safeParse({ answers: [{ questionId: ID(1), optionIds: ["red"] }] }).success).toBe(false);
  });
});
