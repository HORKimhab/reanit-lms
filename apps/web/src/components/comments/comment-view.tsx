import type { LessonComment } from "@reanit/core/learning";
import { cn } from "@reanit/ui/lib/utils";
import { useFormatter, useTranslations } from "next-intl";
import type * as React from "react";

/**
 * One comment or reply: who wrote it (marked when staff), when, and what they wrote.
 *
 * @param props - Component props.
 * @param props.comment - The comment.
 * @param props.isReply - Whether it answers a thread, which indents it.
 * @param props.children - Actions shown under it, such as reply or delete.
 * @returns The comment.
 */
export function CommentView({ comment, isReply = false, children }: { comment: LessonComment; isReply?: boolean; children?: React.ReactNode }) {
  const t = useTranslations("Comments");
  const format = useFormatter();
  const author = comment.author ? (comment.author.name ?? t("noName")) : t("deletedAuthor");

  return (
    <article className={cn("flex flex-col gap-1", isReply && "ml-6 border-l pl-4")}>
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{author}</span>
        {comment.author?.isStaff ? <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{t("staff")}</span> : null}
        {comment.isHidden ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t("hidden")}</span> : null}
        <time dateTime={comment.createdAt.toISOString()} className="text-xs text-muted-foreground">
          {format.dateTime(comment.createdAt, { dateStyle: "medium", timeStyle: "short" })}
        </time>
      </p>
      <p className="whitespace-pre-line text-sm">{comment.body}</p>
      {children}
    </article>
  );
}
