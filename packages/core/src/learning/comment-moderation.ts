import type { Clock } from "../auth";
import { pageWindow } from "../shared/paging";
import { findThreadRoot } from "./comment-threads";
import { COMMENT_INBOX_PAGE_SIZE, type CommentInboxQuery, type CommentThread, type InboxPage, type LessonComment } from "./comments";
import { CommentNotFoundError } from "./errors";
import type { CommentStore } from "./ports";

/**
 * Builds one school's staff side of lesson comments: the inbox, replies and moderation.
 *
 * @param dependencies The school's comments and the clock.
 * @param dependencies.store The school's comments.
 * @param dependencies.clock The current time, for new replies.
 * @returns Inbox, thread, reply and moderation operations.
 * @example
 * const moderation = createCommentModeration({ store: createCommentStore(db, schoolId), clock });
 */
export function createCommentModeration({ store, clock }: { store: CommentStore; clock: Clock }) {
  return {
    /**
     * Lists one page of the school's threads, newest first: all, or those no staff member has answered yet.
     *
     * @param query The page and filter.
     * @param query.page 1-based page; past the last one it is empty.
     * @param query.filter `unanswered` or `all`.
     * @returns The page's threads, hidden ones included, and how many match.
     */
    async listInbox({ page, filter }: CommentInboxQuery): Promise<InboxPage> {
      const { threads, total } = await store.listInbox({ isUnansweredOnly: filter === "unanswered", ...pageWindow(page, COMMENT_INBOX_PAGE_SIZE) });
      return { threads, total, page, pageSize: COMMENT_INBOX_PAGE_SIZE };
    },

    /**
     * Lists a lesson's threads for staff, hidden ones included.
     *
     * @param lessonId The lesson.
     * @returns The threads, newest first.
     */
    listLessonComments(lessonId: string): Promise<CommentThread[]> {
      return store.listThreads(lessonId, { includeHidden: true });
    },

    /**
     * Replies to a thread as staff; a reply to a reply joins its thread.
     *
     * @param staffUserId The staff member replying.
     * @param commentId The comment replied to.
     * @param body The reply.
     * @returns The reply.
     * @throws {CommentNotFoundError} When the school has no such comment.
     */
    async reply(staffUserId: string, commentId: string, body: string): Promise<LessonComment> {
      const root = await findThreadRoot(store, commentId);
      return store.createComment({ lessonId: root.lessonId, authorId: staffUserId, parentId: root.id, body, at: clock.now() });
    },

    /**
     * Hides a comment from students, or shows it again.
     *
     * @param commentId The comment.
     * @param isHidden Whether students stop seeing it.
     * @throws {CommentNotFoundError} When the school has no such comment.
     */
    async setHidden(commentId: string, isHidden: boolean): Promise<void> {
      if (!(await store.setHidden(commentId, isHidden))) throw new CommentNotFoundError();
    },
  };
}

/** One school's staff side of lesson comments. */
export type CommentModeration = ReturnType<typeof createCommentModeration>;
