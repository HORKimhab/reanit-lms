import {
  certificateIdSchema,
  commentInboxQuerySchema,
  commentSchema,
  moderationSchema,
  progressSchema,
  QUESTION_KINDS,
  quizAnswersSchema,
  quizSchema,
  replySchema,
  type CommentThread,
  type LessonComment,
} from "@reanit/core/learning";
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

/** A course as its enrolled student plays it: the outline, their progress per lesson opened, and when they enrolled (drip lessons count from it). */
export class PlayerCourseResponse extends createZodDto(
  z.object({
    course: courseWithOutlineSchema.extend({
      progress: z.array(z.object({ lessonId: z.uuid(), positionSeconds: z.number().int(), isCompleted: z.boolean() })),
      enrolledAt: z.iso.datetime(),
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

/** `POST .../lessons/:lessonId/comments` body: the text, and the comment replied to, if any. */
export class CommentBody extends createZodDto(commentSchema) {}

/** `POST /comments/:id/replies` body. */
export class ReplyBody extends createZodDto(replySchema) {}

/** `PATCH /comments/:id` body. */
export class ModerationBody extends createZodDto(moderationSchema) {}

/** Staff inbox query. */
export class CommentInboxQuery extends createZodDto(commentInboxQuerySchema) {}

/** Path of a comment, on a school site. */
export class PlayerCommentParams extends createZodDto(z.object({ subdomain: subdomainSchema, commentId: z.uuid() })) {}

/** Path of a comment, in the dashboard. */
export class CommentParams extends createZodDto(z.object({ id: z.uuid() })) {}

const commentResponseSchema = z.object({
  id: z.uuid(),
  body: z.string(),
  author: z.object({ id: z.uuid(), name: z.string().nullable(), isStaff: z.boolean() }).nullable(),
  isHidden: z.boolean(),
  createdAt: z.iso.datetime(),
});
const threadResponseSchema = commentResponseSchema.extend({ lessonId: z.uuid(), replies: z.array(commentResponseSchema) });

/** One comment or reply. */
export class CommentResponse extends createZodDto(z.object({ comment: commentResponseSchema })) {}

/** A lesson's threads, newest first, replies oldest first. */
export class CommentThreadsResponse extends createZodDto(z.object({ threads: z.array(threadResponseSchema) })) {}

/** One page of the staff inbox: threads with where they were asked and whether staff answered. */
export class CommentInboxResponse extends createZodDto(
  z.object({
    threads: z.array(
      threadResponseSchema.extend({
        lesson: z.object({ id: z.uuid(), title: z.string() }),
        course: z.object({ slug: z.string(), title: z.string() }),
        isAnswered: z.boolean(),
      }),
    ),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  }),
) {}

/**
 * Shapes a comment for a response, with its time as an ISO date.
 *
 * @param comment The comment.
 * @returns The comment as the API sends it.
 */
export function toCommentResponse(comment: LessonComment): CommentResponse["comment"] {
  return { ...comment, createdAt: comment.createdAt.toISOString() };
}

/**
 * Shapes a thread for a response, with every time as an ISO date.
 *
 * @param thread The thread.
 * @returns The thread as the API sends it.
 */
export function toThreadResponse<Thread extends CommentThread>(thread: Thread) {
  return { ...thread, ...toCommentResponse(thread), replies: thread.replies.map(toCommentResponse) };
}

/** Path of a certificate's public verify page on a school site. */
export class CertificateParams extends createZodDto(z.object({ subdomain: subdomainSchema, certificateId: certificateIdSchema })) {}

/** A certificate as its verify page shows it: who earned which course at which school, and when. */
export class CertificateResponse extends createZodDto(
  z.object({
    certificate: z.object({ id: z.uuid(), studentName: z.string(), courseTitle: z.string(), schoolName: z.string(), issuedAt: z.iso.datetime() }),
  }),
) {}
