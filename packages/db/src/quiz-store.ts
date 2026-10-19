import type { DbClient } from "./client";
import type { Prisma } from "./generated/prisma/client";
import { forSchool } from "./tenant";

/** A quiz as `@reanit/core/learning` saves it; matches its `Quiz` type. */
type Quiz = {
  passPercent: number;
  questions: { id: string; prompt: string; kind: "single" | "multiple"; options: { id: string; text: string; isCorrect: boolean }[] }[];
};

/**
 * One school's quizzes and attempts. Every query goes through the tenant client, so another school's
 * rows are invisible; it satisfies `QuizStore` from `@reanit/core/learning`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @param schoolId The school whose quizzes these are.
 * @returns The store operations.
 * @throws {z.ZodError} When `schoolId` is not a UUID.
 * @example
 * const learning = createLearningService({ catalog, store, quizzes: createQuizStore(db, schoolId), media, clock });
 */
export function createQuizStore(db: DbClient, schoolId: string) {
  const tenant = forSchool(db, schoolId);

  return {
    /**
     * Reads a lesson's type.
     *
     * @param lessonId The lesson.
     * @returns Its type, or null when the school has no such lesson.
     */
    async findLessonType(lessonId: string) {
      return (await tenant.lesson.findFirst({ where: { id: lessonId }, select: { type: true } }))?.type ?? null;
    },

    /**
     * Reads a lesson's quiz.
     *
     * @param lessonId The lesson.
     * @returns The pass mark and questions, or null before the quiz is first saved.
     */
    async findQuiz(lessonId: string): Promise<Quiz | null> {
      const quiz = await tenant.quiz.findUnique({ where: { lessonId }, select: { passPercent: true, questions: true } });
      // `questions` is written only by `saveQuiz`, from a quiz core has parsed.
      return quiz && { passPercent: quiz.passPercent, questions: quiz.questions as Quiz["questions"] };
    },

    /**
     * Saves a lesson's quiz, replacing its questions.
     *
     * @param lessonId The quiz lesson; the caller checked it is the school's.
     * @param quiz The pass mark and questions.
     * @param quiz.passPercent The pass mark.
     * @param quiz.questions The questions with their right options.
     */
    async saveQuiz(lessonId: string, { passPercent, questions }: Quiz) {
      const json = questions as Prisma.InputJsonValue;
      await tenant.quiz.upsert({ where: { lessonId }, create: { schoolId, lessonId, passPercent, questions: json }, update: { passPercent, questions: json } });
    },

    /**
     * Keeps a graded attempt.
     *
     * @param attempt The attempt.
     * @param attempt.enrollmentId The student's enrollment.
     * @param attempt.lessonId The quiz lesson.
     * @param attempt.answers The options picked per question.
     * @param attempt.result Its grade.
     * @param attempt.result.scorePercent The score.
     * @param attempt.result.isPassed Whether it reached the pass mark.
     * @param attempt.at When it was made.
     */
    async recordAttempt({
      enrollmentId,
      lessonId,
      answers,
      result,
      at,
    }: {
      enrollmentId: string;
      lessonId: string;
      answers: { questionId: string; optionIds: string[] }[];
      result: { scorePercent: number; isPassed: boolean };
      at: Date;
    }) {
      await tenant.quizAttempt.create({
        data: { schoolId, enrollmentId, lessonId, answers, scorePercent: result.scorePercent, isPassed: result.isPassed, createdAt: at },
      });
    },

    /**
     * Finds an enrollment's latest attempt at a quiz.
     *
     * @param enrollmentId The enrollment.
     * @param lessonId The quiz lesson.
     * @returns Its score, result and time, or null before the first attempt.
     */
    async findLastAttempt(enrollmentId: string, lessonId: string) {
      const attempt = await tenant.quizAttempt.findFirst({
        where: { enrollmentId, lessonId },
        orderBy: { createdAt: "desc" },
        select: { scorePercent: true, isPassed: true, createdAt: true },
      });
      return attempt && { scorePercent: attempt.scorePercent, isPassed: attempt.isPassed, at: attempt.createdAt };
    },
  };
}
