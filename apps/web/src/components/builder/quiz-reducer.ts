import type { Quiz } from "@reanit/core/learning";

/** A question in the quiz editor. */
type Question = Quiz["questions"][number];

/** An edit the quiz editor makes. Ids of new questions and options are made by the caller. */
export type QuizAction =
  | { type: "setPassPercent"; passPercent: number }
  | { type: "addQuestion"; questionId: string; optionIds: [string, string] }
  | { type: "removeQuestion"; questionId: string }
  | { type: "setPrompt"; questionId: string; prompt: string }
  | { type: "setKind"; questionId: string; kind: Question["kind"] }
  | { type: "addOption"; questionId: string; optionId: string }
  | { type: "removeOption"; questionId: string; optionId: string }
  | { type: "setOptionText"; questionId: string; optionId: string; text: string }
  | { type: "toggleCorrect"; questionId: string; optionId: string };

/**
 * Keeps only the first right option, as a single-answer question allows.
 *
 * @param options The question's options.
 * @returns The options with at most one marked right.
 */
function keepFirstCorrect(options: Question["options"]): Question["options"] {
  const first = options.find((option) => option.isCorrect)?.id;
  return options.map((option) => ({ ...option, isCorrect: option.id === first }));
}

/**
 * Marks an option right or wrong: a single-answer question has exactly the clicked option right,
 * a multiple-answer one flips it.
 *
 * @param question The question.
 * @param question.kind How it is answered.
 * @param question.options Its options.
 * @param optionId The clicked option.
 * @returns The question's new options.
 */
function toggleCorrect({ kind, options }: Question, optionId: string): Question["options"] {
  return options.map((option) =>
    option.id === optionId ? { ...option, isCorrect: kind === "single" || !option.isCorrect } : kind === "single" ? { ...option, isCorrect: false } : option,
  );
}

/**
 * Applies one edit to a question.
 *
 * @param question The question.
 * @param action The edit, aimed at this question.
 * @returns The edited question.
 */
function editQuestion(question: Question, action: Exclude<QuizAction, { type: "setPassPercent" | "addQuestion" | "removeQuestion" }>): Question {
  switch (action.type) {
    case "setPrompt":
      return { ...question, prompt: action.prompt };
    case "setKind":
      return { ...question, kind: action.kind, options: action.kind === "single" ? keepFirstCorrect(question.options) : question.options };
    case "addOption":
      return { ...question, options: [...question.options, { id: action.optionId, text: "", isCorrect: false }] };
    case "removeOption":
      return { ...question, options: question.options.filter((option) => option.id !== action.optionId) };
    case "setOptionText":
      return { ...question, options: question.options.map((option) => (option.id === action.optionId ? { ...option, text: action.text } : option)) };
    case "toggleCorrect":
      return { ...question, options: toggleCorrect(question, action.optionId) };
  }
}

/**
 * The quiz editor's state transitions: pass mark, questions, and each question's answers.
 *
 * @param quiz The quiz being edited.
 * @param action The edit.
 * @returns The edited quiz; the input is never changed.
 * @example
 * quizReducer(quiz, { type: "addQuestion", questionId: crypto.randomUUID(), optionIds: [crypto.randomUUID(), crypto.randomUUID()] });
 */
export function quizReducer(quiz: Quiz, action: QuizAction): Quiz {
  switch (action.type) {
    case "setPassPercent":
      return { ...quiz, passPercent: action.passPercent };
    case "addQuestion":
      return {
        ...quiz,
        questions: [
          ...quiz.questions,
          { id: action.questionId, prompt: "", kind: "single", options: action.optionIds.map((id, index) => ({ id, text: "", isCorrect: index === 0 })) },
        ],
      };
    case "removeQuestion":
      return { ...quiz, questions: quiz.questions.filter((question) => question.id !== action.questionId) };
    default:
      return { ...quiz, questions: quiz.questions.map((question) => (question.id === action.questionId ? editQuestion(question, action) : question)) };
  }
}
