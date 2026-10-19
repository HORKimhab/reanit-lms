"use server";

import { safeRedirectPath } from "@reanit/core/auth";
import { commentSchema, progressSchema, quizAnswersSchema, type ProgressInput, type QuizAnswers, type QuizResult } from "@reanit/core/learning";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { getApi, unexpectedResponse } from "@/server/api";
import { idPath } from "@/server/id-path";
import { checkStudentResponse } from "@/server/schools/student";

/** Result of the last comment or reply sent from a comment form. */
export type CommentFormState = { status: "idle" | "posted" | "invalid" };

/**
 * Sends progress for a lesson to the API.
 *
 * @param subdomain The school's subdomain.
 * @param lessonId The lesson.
 * @param input Untrusted position and/or completion from the browser.
 * @throws {z.ZodError} When the input is not a valid heartbeat.
 * @throws {Error} When the API refuses or fails.
 */
async function sendProgress(subdomain: string, lessonId: string, input: ProgressInput) {
  const body = progressSchema.parse(input);
  const { response } = await (await getApi()).PUT("/schools/by-subdomain/{subdomain}/lessons/{lessonId}/progress", {
    params: { path: { subdomain, lessonId } },
    body,
  });
  if (!response.ok) throw unexpectedResponse(response);
}

/**
 * The player's heartbeat: saves where the video is. Bind the school and lesson: `saveVideoPosition.bind(null, school, lessonId)`.
 *
 * @param subdomain The school's subdomain.
 * @param lessonId The lesson.
 * @param positionSeconds Untrusted position from the browser, in whole seconds.
 * @throws {z.ZodError} When the position is not a whole number of seconds in range.
 * @throws {Error} When the API refuses or fails.
 */
export async function saveVideoPosition(subdomain: string, lessonId: string, positionSeconds: number) {
  await sendProgress(subdomain, lessonId, { positionSeconds });
}

/**
 * Marks a lesson completed and moves on. Bind the school, lesson and where to go next.
 *
 * @param subdomain The school's subdomain.
 * @param lessonId The lesson.
 * @param nextPath The next lesson, or my courses after the last one; only a local path is followed.
 * @throws {Error} Next's redirect signal on success, or when the API refuses or fails.
 */
export async function completeLesson(subdomain: string, lessonId: string, nextPath: string) {
  await sendProgress(subdomain, lessonId, { completed: true });
  redirect({ href: safeRedirectPath(nextPath), locale: await getLocale() });
}

/**
 * Sends a student's quiz answers to be graded; passing completes the lesson. Bind the school and
 * lesson: `submitQuizAnswers.bind(null, school, lessonId)`.
 *
 * @param subdomain The school's subdomain.
 * @param lessonId The quiz lesson.
 * @param answers Untrusted picks from the browser: the option ids per question.
 * @returns The score, whether it passed, and which questions were right.
 * @throws {z.ZodError} When the answers are malformed.
 * @throws {Error} An unexpected-response error, e.g. when the student lost access.
 */
export async function submitQuizAnswers(subdomain: string, lessonId: string, answers: QuizAnswers): Promise<QuizResult> {
  const body = quizAnswersSchema.parse({ answers });
  const { data, response } = await (await getApi()).POST("/schools/by-subdomain/{subdomain}/lessons/{lessonId}/quiz/attempts", {
    params: { path: { subdomain, lessonId } },
    body,
  });
  if (!response.ok) throw unexpectedResponse(response);
  // The API answered 2xx with the result.
  return data!.result;
}

/**
 * Posts the student's comment under a lesson, or their reply when the form names a thread, and
 * refreshes the lesson. Bind the school, lesson and lesson page: `postLessonComment.bind(null, school, lessonId, path)`.
 *
 * @param subdomain The school's subdomain.
 * @param lessonId The lesson.
 * @param lessonPath The lesson's player page, refreshed after posting.
 * @param _previous The form's last state; unused, but `useActionState` passes it first.
 * @param formData Untrusted `body` and optional `parentId`.
 * @returns `posted`, or `invalid` when the text is blank or too long.
 * @throws {Error} Next's redirect or not-found signal, or an unexpected-response error.
 */
export async function postLessonComment(
  subdomain: string,
  lessonId: string,
  lessonPath: string,
  _previous: CommentFormState,
  formData: FormData,
): Promise<CommentFormState> {
  const parsed = commentSchema.safeParse({ body: formData.get("body"), parentId: formData.get("parentId") || undefined });
  if (!parsed.success) return { status: "invalid" };
  const { response } = await (await getApi()).POST("/schools/by-subdomain/{subdomain}/lessons/{lessonId}/comments", {
    params: { path: { subdomain, lessonId } },
    body: parsed.data,
  });
  checkStudentResponse(response, lessonPath);
  revalidatePath(lessonPath);
  return { status: "posted" };
}

/**
 * Deletes one of the student's own comments and refreshes the lesson. Bind the school and lesson
 * page, then the comment: `deleteLessonComment.bind(null, school, path)`.
 *
 * @param subdomain The school's subdomain.
 * @param lessonPath The lesson's player page, refreshed after deleting.
 * @param commentId The comment.
 * @throws {Error} Next's redirect or not-found signal, or an unexpected-response error (403 for someone else's comment).
 */
export async function deleteLessonComment(subdomain: string, lessonPath: string, commentId: string): Promise<void> {
  const { response } = await (await getApi()).DELETE("/schools/by-subdomain/{subdomain}/comments/{commentId}", {
    params: { path: { subdomain, commentId: idPath(commentId).path.id } },
  });
  checkStudentResponse(response, lessonPath);
  revalidatePath(lessonPath);
}
