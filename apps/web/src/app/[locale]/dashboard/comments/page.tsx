import { commentInboxQuerySchema, type CommentInboxQuery } from "@reanit/core/learning";
import { getTranslations } from "next-intl/server";

import { CommentInbox } from "@/components/dashboard/comment-inbox";
import { getCommentInbox } from "@/server/learning/comments";

import { replyToComment, setCommentHidden } from "./actions";

/** The inbox's first page of unanswered threads, for a URL whose query makes no sense. */
const FIRST_PAGE: CommentInboxQuery = { page: 1, filter: "unanswered" };

/**
 * Comment inbox: students' questions under the school's lessons, unanswered first, to answer and moderate.
 *
 * @param props - Page props.
 * @param props.searchParams - `filter` (`unanswered` or `all`) and `page` (1-based).
 * @returns The page heading and the inbox.
 */
export default async function DashboardComments({ searchParams }: PageProps<"/[locale]/dashboard/comments">) {
  const parsed = commentInboxQuerySchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : FIRST_PAGE;
  const [nav, result] = await Promise.all([getTranslations("DashboardNav"), getCommentInbox(query)]);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{nav("comments")}</h1>
      <CommentInbox result={result} filter={query.filter} actions={{ reply: replyToComment, setHidden: setCommentHidden }} />
    </div>
  );
}
