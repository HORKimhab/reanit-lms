import { z } from "zod";

import { pageSchema } from "../shared/paging";

/** Longest comment or reply. */
export const COMMENT_MAX_LENGTH = 2000;
/** Threads shown per page of the staff inbox. */
export const COMMENT_INBOX_PAGE_SIZE = 20;

/** Which threads the staff inbox lists. */
export const COMMENT_INBOX_FILTERS = ["unanswered", "all"] as const;

const bodySchema = z.string().trim().min(1).max(COMMENT_MAX_LENGTH);

/** A comment under a lesson: a new thread, or a reply to one when `parentId` is set. */
export const commentSchema = z.object({ body: bodySchema, parentId: z.uuid().optional() });

/** A staff reply to a thread. */
export const replySchema = z.object({ body: bodySchema });

/** Hides a comment from students, or shows it again. */
export const moderationSchema = z.object({ isHidden: z.boolean() });

/** Staff inbox query: a 1-based page of all threads, or of those no staff member has answered yet. */
export const commentInboxQuerySchema = z.object({ page: pageSchema, filter: z.enum(COMMENT_INBOX_FILTERS).default("unanswered") });

/** Parsed comment input. */
export type CommentInput = z.infer<typeof commentSchema>;
/** Parsed inbox query. */
export type CommentInboxQuery = z.infer<typeof commentInboxQuerySchema>;

/** Who wrote a comment. */
export interface CommentAuthor {
  id: string;
  name: string | null;
  /** True for the school's owner, admins and instructors, whose comments read as answers. */
  isStaff: boolean;
}

/** One comment or reply. */
export interface LessonComment {
  id: string;
  body: string;
  /** Null once the author's account is deleted. */
  author: CommentAuthor | null;
  /** Hidden by staff: students no longer see it. */
  isHidden: boolean;
  createdAt: Date;
}

/** A thread under a lesson: its first comment and the replies, oldest first. */
export type CommentThread = LessonComment & { lessonId: string; replies: LessonComment[] };

/** A thread as the staff inbox lists it, with where it was asked and whether staff answered it. */
export type InboxThread = CommentThread & {
  lesson: { id: string; title: string };
  course: { slug: string; title: string };
  isAnswered: boolean;
};

/** One page of the staff inbox. */
export interface InboxPage {
  threads: InboxThread[];
  total: number;
  page: number;
  pageSize: number;
}
