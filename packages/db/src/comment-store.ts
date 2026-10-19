import type { DbClient } from "./client";
import type { MembershipRole, Prisma } from "./generated/prisma/client";
import { forSchool } from "./tenant";

/** Roles whose comments read as answers; matches staff in `@reanit/core/schools`. */
const STAFF_ROLES: MembershipRole[] = ["owner", "admin", "instructor"];
const OLDEST_FIRST = { createdAt: "asc" } as const;
const NEWEST_FIRST = { createdAt: "desc" } as const;

/** A comment's columns with its author and whether they are the school's staff (RLS keeps memberships to this school). */
const COMMENT_FIELDS = {
  id: true,
  body: true,
  isHidden: true,
  createdAt: true,
  author: { select: { id: true, name: true, memberships: { where: { role: { in: STAFF_ROLES } }, select: { id: true }, take: 1 } } },
} satisfies Prisma.LessonCommentSelect;

/** A comment row as `COMMENT_FIELDS` selects it. */
type CommentRow = Prisma.LessonCommentGetPayload<{ select: typeof COMMENT_FIELDS }>;

/**
 * Shapes a comment row as the learning module reads it.
 *
 * @param row The stored comment.
 * @param row.author Its author with their staff membership, if any.
 * @returns The comment with its author marked staff or not.
 */
function toComment({ author, ...comment }: CommentRow) {
  return { ...comment, author: author && { id: author.id, name: author.name, isStaff: author.memberships.length > 0 } };
}

/**
 * The threads' columns: the first comment, its lesson and its replies, oldest first.
 *
 * @param includeHidden Whether hidden replies are loaded.
 * @returns The Prisma selection.
 */
function threadFields(includeHidden: boolean) {
  return {
    ...COMMENT_FIELDS,
    lessonId: true,
    replies: { where: includeHidden ? {} : { isHidden: false }, orderBy: OLDEST_FIRST, select: COMMENT_FIELDS },
  } satisfies Prisma.LessonCommentSelect;
}

/**
 * Shapes a thread row: its first comment with its replies.
 *
 * @param row The stored thread.
 * @param row.replies Its replies.
 * @returns The thread.
 */
function toThread({ replies, ...root }: CommentRow & { lessonId: string; replies: CommentRow[] }) {
  return { ...toComment(root), lessonId: root.lessonId, replies: replies.map(toComment) };
}

/**
 * One school's lesson comments. Every query goes through the tenant client, so another school's
 * comments are invisible; it satisfies `CommentStore` from `@reanit/core/learning`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @param schoolId The school whose comments these are.
 * @returns The store operations.
 * @throws {z.ZodError} When `schoolId` is not a UUID.
 * @example
 * const moderation = createCommentModeration({ store: createCommentStore(db, schoolId), clock });
 */
export function createCommentStore(db: DbClient, schoolId: string) {
  const tenant = forSchool(db, schoolId);
  /** Threads with no reply from the school's staff. */
  const UNANSWERED = { replies: { none: { author: { memberships: { some: { role: { in: STAFF_ROLES } } } } } } } satisfies Prisma.LessonCommentWhereInput;

  return {
    /**
     * Lists a lesson's threads.
     *
     * @param lessonId The lesson.
     * @param options Which comments to include.
     * @param options.includeHidden Whether hidden threads and replies are included.
     * @returns The threads newest first, replies oldest first.
     */
    async listThreads(lessonId: string, { includeHidden }: { includeHidden: boolean }) {
      const rows = await tenant.lessonComment.findMany({
        where: { lessonId, parentId: null, ...(includeHidden ? {} : { isHidden: false }) },
        orderBy: NEWEST_FIRST,
        select: threadFields(includeHidden),
      });
      return rows.map(toThread);
    },

    /**
     * Finds where a comment sits.
     *
     * @param commentId The comment.
     * @returns Its lesson, author and thread, or null when the school has no such comment.
     */
    findComment(commentId: string) {
      return tenant.lessonComment.findFirst({ where: { id: commentId }, select: { id: true, lessonId: true, authorId: true, parentId: true } });
    },

    /**
     * Writes a comment or reply.
     *
     * @param comment The comment.
     * @param comment.lessonId Its lesson.
     * @param comment.authorId Its author.
     * @param comment.parentId The thread it replies to, or null for a new thread.
     * @param comment.body Its text.
     * @param comment.at When it was written.
     * @returns The comment.
     */
    async createComment({ lessonId, authorId, parentId, body, at }: { lessonId: string; authorId: string; parentId: string | null; body: string; at: Date }) {
      return toComment(await tenant.lessonComment.create({ data: { schoolId, lessonId, authorId, parentId, body, createdAt: at }, select: COMMENT_FIELDS }));
    },

    /**
     * Removes a comment; its replies go with it.
     *
     * @param commentId The comment.
     */
    async deleteComment(commentId: string) {
      await tenant.lessonComment.deleteMany({ where: { id: commentId } });
    },

    /**
     * Hides a comment from students, or shows it again.
     *
     * @param commentId The comment.
     * @param isHidden Whether students stop seeing it.
     * @returns False when the school has no such comment.
     */
    async setHidden(commentId: string, isHidden: boolean) {
      return (await tenant.lessonComment.updateMany({ where: { id: commentId }, data: { isHidden } })).count > 0;
    },

    /**
     * Lists threads for the staff inbox, hidden ones included, with their lesson and course.
     *
     * @param query The filter and window.
     * @param query.isUnansweredOnly Whether only threads without a staff reply are listed.
     * @param query.limit Threads to return.
     * @param query.offset Threads to skip.
     * @returns The window's threads, newest first, and how many match.
     */
    async listInbox({ isUnansweredOnly, limit, offset }: { isUnansweredOnly: boolean; limit: number; offset: number }) {
      const where = { parentId: null, ...(isUnansweredOnly ? UNANSWERED : {}) };
      const [rows, total] = await Promise.all([
        tenant.lessonComment.findMany({
          where,
          orderBy: NEWEST_FIRST,
          take: limit,
          skip: offset,
          select: { ...threadFields(true), lesson: { select: { id: true, title: true, section: { select: { course: { select: { slug: true, title: true } } } } } } },
        }),
        tenant.lessonComment.count({ where }),
      ]);
      const threads = rows.map(({ lesson, ...row }) => {
        const thread = toThread(row);
        return { ...thread, lesson: { id: lesson.id, title: lesson.title }, course: lesson.section.course, isAnswered: thread.replies.some((reply) => reply.author?.isStaff) };
      });
      return { threads, total };
    },
  };
}
