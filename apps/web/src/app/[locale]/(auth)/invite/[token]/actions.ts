"use server";

import { redirect } from "next/navigation";

import { getApi, unexpectedResponse } from "@/server/api";
import { requireUser } from "@/server/auth/session";
import { invitePath } from "@/server/schools/team";

/** Result of the last accept, shown by the invite card; on success the action goes to the dashboard instead. */
export type AcceptInviteState = { status: "idle" | "mismatch" | "expired" | "used" };

/** Where a new team member lands: their school's dashboard. */
const DASHBOARD_PATH = "/dashboard";

/** What each refusal of the API means for the card. */
const REFUSALS: Record<number, AcceptInviteState["status"]> = { 403: "mismatch", 410: "expired", 404: "used" };

/**
 * Accepts an invite for the signed-in user, then opens the dashboard of the school they joined.
 * Bind the token: `acceptInvite.bind(null, token)`.
 *
 * @param token - The token from the link.
 * @param _previous - The card's last state; unused, but `useActionState` passes it.
 * @returns Why it failed: another account's email, an expired link, or a link already used.
 * @throws {Error} Next's redirect signal (to log in when signed out, or to the dashboard on success), or an unexpected-response error.
 */
export async function acceptInvite(token: string, _previous: AcceptInviteState): Promise<AcceptInviteState> {
  await requireUser(invitePath(token));
  const { response } = await (await getApi()).POST("/invites/{token}/accept", { params: { path: { token } } });
  const refusal = REFUSALS[response.status];
  if (refusal) return { status: refusal };
  if (!response.ok) throw unexpectedResponse(response);
  redirect(DASHBOARD_PATH);
}
