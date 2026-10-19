import { progressSchema, QUESTION_KINDS, quizAnswersSchema, quizSchema } from "@reanit/core/learning";
import { subdomainSchema } from "@reanit/core/schools";
import { z } from "zod";

import { courseWithOutlineSchema } from "../catalog/catalog.dto";
import { createZodDto } from "../http/zod-dto";

/** Path of a course in a school's player. */
export class PlayerCourseParams extends createZodDto(z.object({ subdomain: subdomainSchema, slug: z.string().min(1).max(80) })) {}

/** Path of a lesson in a school's player. */
export class PlayerLessonParams extends createZodDto(z.object({ subdomain: subdomainSchema, lessonId: z.uuid() })) {}

/** `PUT .../lessons/:lessonId/progress` body: a heartbeat's video position, completion, or both. */
export class ProgressBody extends createZodDto(progressSchema) {}

/** A course as its enrolled student plays it: the outline and their progress per lesson opened. */
export class PlayerCourseResponse extends createZodDto(
  z.object({
    course: courseWithOutlineSchema.extend({
      progress: z.array(z.object({ lessonId: z.uuid(), positionSeconds: z.number().int(), isCompleted: z.boolean() })),
    }),
  }),
) {}

/** Path of a lesson in the quiz builder. */
export class QuizLessonParams extends createZodDto(z.object({ lessonId: z.uuid() })) {}

/** `PUT /lessons/:lessonId/quiz` body: the pass mark and questions with their right options. */
export class QuizBody extends createZodDto(quizSchema) {}

/** `POST .../lessons/:lessonId/quiz/attempts` body: the options picked per question. */
export class QuizAnswersBody extends createZodDto(quizAnswersSchema) {}

/** A quiz with its right answers, for the builder; a quiz never saved has no questions. */
export class QuizResponse extends createZodDto(
  z.object({ quiz: z.object({ passPercent: z.number().int(), questions: z.array(quizSchema.shape.questions.element) }) }),
) {}

/** A quiz as its student takes it, without the right answers, with their last attempt. */
export class StudentQuizResponse extends createZodDto(
  z.object({
    quiz: z.object({
      passPercent: z.number().int(),
      questions: z.array(
        z.object({ id: z.uuid(), prompt: z.string(), kind: z.enum(QUESTION_KINDS), options: z.array(z.object({ id: z.uuid(), text: z.string() })) }),
      ),
      lastAttempt: z.object({ scorePercent: z.number().int(), isPassed: z.boolean(), at: z.iso.datetime() }).nullable(),
    }),
  }),
) {}

/** How an attempt went: the score, whether it passed, and which questions were right. */
export class QuizResultResponse extends createZodDto(
  z.object({
    result: z.object({
      scorePercent: z.number().int(),
      isPassed: z.boolean(),
      questions: z.array(z.object({ questionId: z.uuid(), isCorrect: z.boolean() })),
    }),
  }),
) {}
