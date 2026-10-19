"use client";

import { COMMENT_MAX_LENGTH } from "@reanit/core/learning";
import { cn } from "@reanit/ui/lib/utils";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import type { CommentFormState } from "@/app/[locale]/s/[school]/learn/actions";
import { Field, INPUT_CLASS } from "@/components/form/field";
import { SubmitRow } from "@/components/form/submit-row";

const IDLE: CommentFormState = { status: "idle" };

/**
 * Writes a comment, or a reply to a thread; the box clears once it is posted.
 *
 * @param props - Component props.
 * @param props.action - Posts the text; bound to where it goes.
 * @param props.label - The box's label.
 * @param props.isReply - Whether it replies to a thread, which makes it smaller and labels the button "Reply".
 * @param props.parentId - The thread replied to, posted with the text.
 * @returns The form.
 */
export function CommentForm({
  action,
  label,
  isReply = false,
  parentId,
}: {
  action: (state: CommentFormState, formData: FormData) => Promise<CommentFormState>;
  label: string;
  isReply?: boolean;
  parentId?: string;
}) {
  const t = useTranslations("Comments");
  const [state, formAction, isPending] = useActionState(action, IDLE);

  return (
    <form action={formAction} className={cn("flex flex-col gap-2", isReply && "ml-6")}>
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
      <Field label={label} error={state.status === "invalid" ? t("invalid", { max: COMMENT_MAX_LENGTH }) : undefined}>
        {(control) => (
          <textarea {...control} name="body" required maxLength={COMMENT_MAX_LENGTH} rows={isReply ? 2 : 3} className={cn(INPUT_CLASS, "h-auto py-2")} />
        )}
      </Field>
      <SubmitRow label={isReply ? t("reply") : t("post")} pendingLabel={isReply ? t("replying") : t("posting")} isPending={isPending} />
    </form>
  );
}
