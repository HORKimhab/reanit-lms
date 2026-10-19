"use server";

import { replySchema } from "@reanit/core/learning";
import { revalidatePath } from "next/cache";

import type { CommentFormState } from "@/app/[locale]/s/[school]/learn/actions";
import { getApi } from "@/server/api";
import { idPath } from "@/server/id-path";
import { checkStaffResponse } from "@/server/schools/staff";

/** Where the comment inbox lives, refreshed after every change. */
const COMMENTS_PATH = "/dashboard/comments";

/**
 * Replies to a thread as the signed-in staff member and refreshes the inbox. Bind the comment:
 * `replyToComment.bind(null, commentId)`.
 *
 * @param commentId The comment replied to.
 * @param _previous The form's last state; unused, but `useActionState` passes it first.
 * @param formData Untrusted `body`.
 * @returns `posted`, or `invalid` when the text is blank or too long.
 * @throws {Error} Next's redirect or not-found signal, or an unexpected-response error.
 */
export async function replyToComment(commentId: string, _previous: CommentFormState, formData: FormData): Promise<CommentFormState> {
  const parsed = replySchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) return { status: "invalid" };
  const { response } = await (await getApi()).POST("/comments/{id}/replies", { params: idPath(commentId), body: parsed.data });
  checkStaffResponse(response);
  revalidatePath(COMMENTS_PATH);
  return { status: "posted" };
}

/**
 * Hides a comment from students, or shows it again, and refreshes the inbox. Bind the comment and
 * the new state: `setCommentHidden.bind(null, commentId, true)`.
 *
 * @param commentId The comment.
 * @param isHidden Whether students stop seeing it.
 * @throws {Error} Next's redirect or not-found signal, or an unexpected-response error.
 */
export async function setCommentHidden(commentId: string, isHidden: boolean): Promise<void> {
  const { response } = await (await getApi()).PATCH("/comments/{id}", { params: idPath(commentId), body: { isHidden } });
  checkStaffResponse(response);
  revalidatePath(COMMENTS_PATH);
}
