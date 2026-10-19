import { z } from "zod";

/** Ways a question is answered: one right option, or every right option. */
export const QUESTION_KINDS = ["single", "multiple"] as const;

/** Most questions a quiz holds. */
export const MAX_QUIZ_QUESTIONS = 50;
/** Most options a question offers. */
export const MAX_QUESTION_OPTIONS = 10;
/** Longest question prompt. */
export const PROMPT_MAX_LENGTH = 1000;
/** Longest option text. */
export const OPTION_MAX_LENGTH = 300;
/** Pass mark of a new quiz, in percent. */
export const DEFAULT_PASS_PERCENT = 70;

const MIN_QUESTION_OPTIONS = 2;
const WHOLE_PERCENT = 100;

/** A question as the quiz builder saves it. Ids are made by the client, like the outline's. */
const questionSchema = z
  .object({
    id: z.uuid(),
    prompt: z.string().trim().min(1).max(PROMPT_MAX_LENGTH),
    kind: z.enum(QUESTION_KINDS),
    options: z
      .array(z.object({ id: z.uuid(), text: z.string().trim().min(1).max(OPTION_MAX_LENGTH), isCorrect: z.boolean() }))
      .min(MIN_QUESTION_OPTIONS)
      .max(MAX_QUESTION_OPTIONS),
  })
  .refine(({ kind, options }) => {
    const correct = options.filter((option) => option.isCorrect).length;
    return kind === "single" ? correct === 1 : correct >= 1;
  }, "A single-answer question has exactly one right option; a multiple-answer one at least one");

/** A quiz as the builder saves it: its pass mark and questions in order. */
export const quizSchema = z.object({
  passPercent: z.number().int().min(1).max(WHOLE_PERCENT),
  questions: z.array(questionSchema).min(1).max(MAX_QUIZ_QUESTIONS),
});

/** A student's answers: the options they picked for each question. */
export const quizAnswersSchema = z.object({
  answers: z.array(z.object({ questionId: z.uuid(), optionIds: z.array(z.uuid()).max(MAX_QUESTION_OPTIONS) })).max(MAX_QUIZ_QUESTIONS),
});

/** A quiz with its right answers, as staff edit it. */
export type Quiz = z.infer<typeof quizSchema>;
/** A student's parsed answers. */
export type QuizAnswers = z.infer<typeof quizAnswersSchema>["answers"];

/** A quiz as a student takes it: the right answers stay on the server. */
export type StudentQuiz = {
  passPercent: number;
  questions: { id: string; prompt: string; kind: Quiz["questions"][number]["kind"]; options: { id: string; text: string }[] }[];
};

/** How an attempt went. */
export interface QuizResult {
  /** 0 to 100, rounded. */
  scorePercent: number;
  isPassed: boolean;
  /** Whether each question was answered right, in quiz order. */
  questions: { questionId: string; isCorrect: boolean }[];
}

/**
 * Hides a quiz's right answers from the student taking it.
 *
 * @param quiz The quiz.
 * @returns Its pass mark and questions without which options are right.
 * @example
 * toStudentQuiz(quiz).questions[0].options; // [{ id, text }, …]
 */
export function toStudentQuiz(quiz: Quiz): StudentQuiz {
  return {
    passPercent: quiz.passPercent,
    questions: quiz.questions.map(({ id, prompt, kind, options }) => ({ id, prompt, kind, options: options.map(({ id: optionId, text }) => ({ id: optionId, text })) })),
  };
}

/**
 * Grades an attempt: a question is right when exactly its right options were picked, and the score
 * is the share of right questions. Unanswered questions are wrong; answers to unknown questions are ignored.
 *
 * @param quiz The quiz with its right answers.
 * @param answers The student's picks.
 * @returns The score, whether it reaches the pass mark, and each question's result.
 * @example
 * gradeQuiz(quiz, [{ questionId, optionIds: [rightId] }]); // { scorePercent: 100, isPassed: true, … }
 */
export function gradeQuiz(quiz: Quiz, answers: QuizAnswers): QuizResult {
  const picked = new Map(answers.map(({ questionId, optionIds }) => [questionId, new Set(optionIds)]));
  const questions = quiz.questions.map(({ id, options }) => {
    const choice = picked.get(id) ?? new Set<string>();
    const isCorrect = options.every((option) => option.isCorrect === choice.has(option.id)) && choice.size === options.filter((option) => option.isCorrect).length;
    return { questionId: id, isCorrect };
  });
  const scorePercent = Math.round((questions.filter((question) => question.isCorrect).length / questions.length) * WHOLE_PERCENT);
  return { scorePercent, isPassed: scorePercent >= quiz.passPercent, questions };
}
