import { CommentNotFoundError } from "./errors";
import type { CommentStore } from "./ports";

/**
 * Finds the thread a comment belongs to, so a reply to a reply joins the same thread (threads are one level deep).
 *
 * @param store The school's comments.
 * @param commentId The comment being replied to.
 * @returns The thread's first comment and its lesson.
 * @throws {CommentNotFoundError} When the school has no such comment.
 */
export async function findThreadRoot(store: CommentStore, commentId: string): Promise<{ id: string; lessonId: string }> {
  const comment = await store.findComment(commentId);
  if (!comment) throw new CommentNotFoundError();
  return { id: comment.parentId ?? comment.id, lessonId: comment.lessonId };
}
