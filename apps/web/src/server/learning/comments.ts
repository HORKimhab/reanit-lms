import type { CommentInboxQuery, CommentThread, InboxPage, LessonComment } from "@reanit/core/learning";

import { getApi } from "../api";
import { checkStaffResponse } from "../schools/staff";
import { checkStudentResponse } from "../schools/student";

/** A comment as the API sends it: its time as an ISO date. */
type CommentJson = Omit<LessonComment, "createdAt"> & { createdAt: string };

/**
 * Reads a comment's time back into a Date.
 *
 * @param comment The comment from the API.
 * @returns The comment.
 */
function toComment(comment: CommentJson): LessonComment {
  return { ...comment, createdAt: new Date(comment.createdAt) };
}

/**
 * Reads a thread's times back into Dates.
 *
 * @param thread The thread from the API.
 * @param thread.replies Its replies.
 * @returns The thread.
 */
function toThread<Thread extends CommentJson & { replies: CommentJson[] }>({ replies, ...thread }: Thread) {
  return { ...thread, ...toComment(thread), replies: replies.map(toComment) };
}

/**
 * Loads a lesson's comments for its enrolled student; comments staff hid are left out.
 *
 * @param subdomain The school's subdomain.
 * @param lessonId The lesson.
 * @param returnPath Where a signed-out student comes back to after logging in.
 * @returns The threads, newest first.
 * @throws {Error} Next's redirect or not-found signal, or an unexpected-response error.
 */
export async function getLessonComments(subdomain: string, lessonId: string, returnPath: string): Promise<CommentThread[]> {
  const { data, response } = await (await getApi()).GET("/schools/by-subdomain/{subdomain}/lessons/{lessonId}/comments", {
    params: { path: { subdomain, lessonId } },
  });
  checkStudentResponse(response, returnPath);
  // checkStudentResponse returned, so the API answered 2xx with the threads.
  return data!.threads.map(toThread);
}

/**
 * Loads one page of the signed-in creator's school's comment inbox.
 *
 * @param query The page and filter.
 * @returns The page's threads, hidden ones included, newest first.
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
export async function getCommentInbox(query: CommentInboxQuery): Promise<InboxPage> {
  const { data, response } = await (await getApi()).GET("/comments", { params: { query } });
  checkStaffResponse(response);
  // checkStaffResponse returned, so the API answered 2xx with the page.
  const page = data!;
  return { ...page, threads: page.threads.map(toThread) };
}
