import type { Quiz } from "@reanit/core/learning";
import { describe, expect, it } from "vitest";

import { quizReducer } from "./quiz-reducer";

const EMPTY: Quiz = { passPercent: 70, questions: [] };

/**
 * Builds a quiz with one question whose answers are a, b and c, b being right.
 *
 * @param kind How the question is answered.
 * @returns The quiz.
 */
function oneQuestion(kind: "single" | "multiple" = "single"): Quiz {
  return {
    passPercent: 70,
    questions: [
      {
        id: "q",
        prompt: "Pick",
        kind,
        options: ["a", "b", "c"].map((id) => ({ id, text: id.toUpperCase(), isCorrect: id === "b" })),
      },
    ],
  };
}

/**
 * Lists a quiz's right options per question.
 *
 * @param quiz The quiz.
 * @returns The ids of the right options.
 */
function rightOptions(quiz: Quiz) {
  return quiz.questions.map((question) => question.options.filter((option) => option.isCorrect).map((option) => option.id));
}

describe("quizReducer", () => {
  it("adds a single-answer question with two blank answers, the first marked right", () => {
    const quiz = quizReducer(EMPTY, { type: "addQuestion", questionId: "q", optionIds: ["a", "b"] });

    expect(quiz.questions).toEqual([
      {
        id: "q",
        prompt: "",
        kind: "single",
        options: [
          { id: "a", text: "", isCorrect: true },
          { id: "b", text: "", isCorrect: false },
        ],
      },
    ]);
  });

  it("moves the right answer of a single-answer question to the clicked one", () => {
    expect(rightOptions(quizReducer(oneQuestion(), { type: "toggleCorrect", questionId: "q", optionId: "c" }))).toEqual([["c"]]);
  });

  it("flips only the clicked answer of a multiple-answer question", () => {
    const quiz = quizReducer(oneQuestion("multiple"), { type: "toggleCorrect", questionId: "q", optionId: "c" });

    expect(rightOptions(quiz)).toEqual([["b", "c"]]);
    expect(rightOptions(quizReducer(quiz, { type: "toggleCorrect", questionId: "q", optionId: "b" }))).toEqual([["c"]]);
  });

  it("keeps only the first right answer when a question becomes single-answer", () => {
    const multiple = quizReducer(oneQuestion("multiple"), { type: "toggleCorrect", questionId: "q", optionId: "a" });

    expect(rightOptions(quizReducer(multiple, { type: "setKind", questionId: "q", kind: "single" }))).toEqual([["a"]]);
  });

  it("edits a prompt and an answer's text, and adds and removes answers", () => {
    let quiz = quizReducer(oneQuestion(), { type: "setPrompt", questionId: "q", prompt: "Which?" });
    quiz = quizReducer(quiz, { type: "setOptionText", questionId: "q", optionId: "a", text: "Red" });
    quiz = quizReducer(quiz, { type: "addOption", questionId: "q", optionId: "d" });
    quiz = quizReducer(quiz, { type: "removeOption", questionId: "q", optionId: "c" });

    expect(quiz.questions[0]?.prompt).toBe("Which?");
    expect(quiz.questions[0]?.options.map(({ id, text }) => [id, text])).toEqual([
      ["a", "Red"],
      ["b", "B"],
      ["d", ""],
    ]);
  });

  it("sets the pass mark and removes a question, leaving the input unchanged", () => {
    const before = oneQuestion();

    const quiz = quizReducer(quizReducer(before, { type: "setPassPercent", passPercent: 90 }), { type: "removeQuestion", questionId: "q" });

    expect(quiz).toEqual({ passPercent: 90, questions: [] });
    expect(before.questions).toHaveLength(1);
  });
});
