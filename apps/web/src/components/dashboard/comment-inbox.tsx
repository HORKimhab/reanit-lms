import type { CommentInboxQuery, InboxPage } from "@reanit/core/learning";
import { COMMENT_INBOX_FILTERS } from "@reanit/core/learning";
import { Button } from "@reanit/ui/components/button";
import { cn } from "@reanit/ui/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";

import type { CommentFormState } from "@/app/[locale]/s/[school]/learn/actions";
import { CommentForm } from "@/components/comments/comment-form";
import { CommentView } from "@/components/comments/comment-view";
import { EmptyState } from "@/components/shells/empty-state";
import { Pager } from "@/components/shells/pager";
import { Link } from "@/i18n/navigation";

/** Where the inbox lives; filter and page links stay on it. */
const COMMENTS_PATH = "/dashboard/comments";

/** The server actions the inbox calls. */
export type CommentInboxActions = {
  reply: (commentId: string, state: CommentFormState, formData: FormData) => Promise<CommentFormState>;
  setHidden: (commentId: string, isHidden: boolean) => Promise<void>;
};

/**
 * The staff comment inbox: unanswered or all threads, each with where it was asked, its replies, a
 * reply box, and buttons to hide comments from students or show them again.
 *
 * @param props - Component props.
 * @param props.result - One page of threads.
 * @param props.filter - Which threads the page holds.
 * @param props.actions - Replies and moderates.
 * @returns The filter links, the threads and their pages, or an empty state.
 */
export function CommentInbox({ result, filter, actions }: { result: InboxPage; filter: CommentInboxQuery["filter"]; actions: CommentInboxActions }) {
  const t = useTranslations("Comments");
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={t("filterLabel")} className="flex gap-2 text-sm">
        {COMMENT_INBOX_FILTERS.map((option) => (
          <Link
            key={option}
            href={{ pathname: COMMENTS_PATH, query: { filter: option } }}
            aria-current={option === filter ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1", option === filter && "border-primary bg-primary/10 font-medium")}
          >
            {t(`filters.${option}`)}
          </Link>
        ))}
      </nav>
      {result.threads.length === 0 ? (
        filter === "unanswered" ? (
          <EmptyState title={t("inboxEmptyTitle")} text={t("inboxEmptyText")} />
        ) : (
          <EmptyState title={t("allEmptyTitle")} text={t("allEmptyText")} />
        )
      ) : (
        <>
          <ol className="flex flex-col gap-4">
            {result.threads.map((thread) => (
              <li key={thread.id} className="flex flex-col gap-3 rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">{t("where", { course: thread.course.title, lesson: thread.lesson.title })}</p>
                <CommentView comment={thread}>
                  <HideToggle commentId={thread.id} isHidden={thread.isHidden} setHidden={actions.setHidden} />
                </CommentView>
                {thread.replies.map((reply) => (
                  <CommentView key={reply.id} comment={reply} isReply>
                    <HideToggle commentId={reply.id} isHidden={reply.isHidden} setHidden={actions.setHidden} />
                  </CommentView>
                ))}
                <CommentForm action={actions.reply.bind(null, thread.id)} label={t("replyLabel", { name: thread.author?.name ?? t("noName") })} isReply />
              </li>
            ))}
          </ol>
          <Pager label={t("inboxPages")} page={result.page} pages={pages} hrefFor={(page) => ({ pathname: COMMENTS_PATH, query: { filter, page } })} />
        </>
      )}
    </div>
  );
}

/**
 * Hides a comment from students, or shows a hidden one again.
 *
 * @param props - Component props.
 * @param props.commentId - The comment.
 * @param props.isHidden - Whether it is hidden now.
 * @param props.setHidden - Hides or shows a comment.
 * @returns The button.
 */
function HideToggle({ commentId, isHidden, setHidden }: { commentId: string; isHidden: boolean; setHidden: CommentInboxActions["setHidden"] }) {
  const t = useTranslations("Comments");
  const Icon = isHidden ? Eye : EyeOff;
  return (
    <form action={setHidden.bind(null, commentId, !isHidden)}>
      <Button type="submit" variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
        <Icon aria-hidden />
        {isHidden ? t("show") : t("hide")}
      </Button>
    </form>
  );
}
