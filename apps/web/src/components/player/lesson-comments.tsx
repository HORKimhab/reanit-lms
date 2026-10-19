import type { CommentThread } from "@reanit/core/learning";
import { Button } from "@reanit/ui/components/button";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import type { CommentFormState } from "@/app/[locale]/s/[school]/learn/actions";
import { CommentForm } from "@/components/comments/comment-form";
import { CommentView } from "@/components/comments/comment-view";

/** The server actions the comments section calls, bound to the school and lesson. */
export type LessonCommentActions = {
  post: (state: CommentFormState, formData: FormData) => Promise<CommentFormState>;
  remove: (commentId: string) => Promise<void>;
};

/**
 * The questions and comments under a lesson: a box for a new one, then each thread with its replies,
 * a reply box, and a delete button on the student's own comments.
 *
 * @param props - Component props.
 * @param props.threads - The lesson's threads, newest first.
 * @param props.userId - The signed-in student, whose comments they can delete.
 * @param props.actions - Posts and deletes comments.
 * @returns The comments section.
 */
export function LessonComments({ threads, userId, actions }: { threads: CommentThread[]; userId: string; actions: LessonCommentActions }) {
  const t = useTranslations("Comments");

  return (
    <section aria-labelledby="lesson-comments" className="flex flex-col gap-6 border-t pt-6">
      <h2 id="lesson-comments" className="text-lg font-semibold">
        {t("title")}
      </h2>
      <CommentForm action={actions.post} label={t("newLabel")} />
      {threads.length === 0 ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : null}
      <ol className="flex flex-col gap-6">
        {threads.map((thread) => (
          <li key={thread.id} className="flex flex-col gap-3">
            <CommentView comment={thread}>
              <DeleteOwn comment={thread} userId={userId} remove={actions.remove} />
            </CommentView>
            {thread.replies.map((reply) => (
              <CommentView key={reply.id} comment={reply} isReply>
                <DeleteOwn comment={reply} userId={userId} remove={actions.remove} />
              </CommentView>
            ))}
            <CommentForm action={actions.post} label={t("replyLabel", { name: thread.author?.name ?? t("noName") })} isReply parentId={thread.id} />
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Offers to delete a comment when the signed-in student wrote it.
 *
 * @param props - Component props.
 * @param props.comment - The comment.
 * @param props.comment.id - Its id.
 * @param props.comment.author - Who wrote it, or null for a deleted account.
 * @param props.userId - The signed-in student.
 * @param props.remove - Deletes a comment.
 * @returns The delete button, or nothing for someone else's comment.
 */
function DeleteOwn({
  comment,
  userId,
  remove,
}: {
  comment: { id: string; author: { id: string } | null };
  userId: string;
  remove: (commentId: string) => Promise<void>;
}) {
  const t = useTranslations("Comments");
  if (comment.author?.id !== userId) return null;
  return (
    <form action={remove.bind(null, comment.id)}>
      <Button type="submit" variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
        <Trash2 aria-hidden />
        {t("delete")}
      </Button>
    </form>
  );
}
