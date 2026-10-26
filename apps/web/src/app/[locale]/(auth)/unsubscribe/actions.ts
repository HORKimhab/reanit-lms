"use server";

import { unsubscribeSchema } from "@reanit/core/notifications";

import { getApi, unexpectedResponse } from "@/server/api";

/** Result of following an unsubscribe link: not yet, done (with the school's name), or a link that is not valid. */
export type UnsubscribeState = { status: "idle" } | { status: "done"; schoolName: string } | { status: "invalid" };

/** API answers that mean the link is not valid: malformed (400) or an unknown token (404). */
const INVALID_LINK = new Set([400, 404]);

/**
 * Stops the kind of staff email an unsubscribe link names. It takes a click on the page, not just
 * opening the link, so mail scanners that open links do not unsubscribe anyone.
 *
 * @param _previous - The form's last state; unused, but `useActionState` passes it first.
 * @param formData - The link's token and kind, carried in hidden fields; untrusted until parsed.
 * @returns `done` with the school's name, or `invalid`.
 * @throws {Error} An unexpected-response error.
 */
export async function unsubscribe(_previous: UnsubscribeState, formData: FormData): Promise<UnsubscribeState> {
  const parsed = unsubscribeSchema.safeParse({ token: formData.get("token"), kind: formData.get("kind") });
  if (!parsed.success) return { status: "invalid" };
  const { data, response } = await (await getApi()).POST("/notifications/unsubscribe", { body: parsed.data });
  if (INVALID_LINK.has(response.status)) return { status: "invalid" };
  if (!data) throw unexpectedResponse(response);
  return { status: "done", schoolName: data.schoolName };
}
