import type { InvitePreview, Team } from "@reanit/core/schools";
import { notFound } from "next/navigation";

import { getApi, unexpectedResponse } from "../api";
import { checkStaffResponse } from "./staff";

/** What an invite link opens: the invite, or the news that it expired. */
export type InviteLink = { status: "open"; invite: InvitePreview } | { status: "expired" };

/**
 * Builds the page an invite email links to; the API writes the same path into the email.
 *
 * @param token The invite's token.
 * @returns The path.
 */
export function invitePath(token: string): string {
  return `/invite/${encodeURIComponent(token)}`;
}

/**
 * Loads the signed-in owner's or admin's school's team.
 *
 * @returns The members, owner first, and the invites not accepted yet, newest first, with dates.
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
export async function getTeam(): Promise<Team> {
  const { data, response } = await (await getApi()).GET("/team");
  checkStaffResponse(response);
  // checkStaffResponse returned, so the API answered 2xx with the team.
  const { members, invites } = data!;
  return {
    members: members.map((member) => ({ ...member, joinedAt: new Date(member.joinedAt) })),
    invites: invites.map((invite) => ({ ...invite, expiresAt: new Date(invite.expiresAt), createdAt: new Date(invite.createdAt) })),
  };
}

/**
 * Reads what an invite link is for; anyone with the link may, signed in or not.
 *
 * @param token The token from the link.
 * @returns The open invite, or `expired`.
 * @throws {Error} Next's not-found signal for a link that is unknown, used or replaced, or an unexpected-response error.
 */
export async function getInviteLink(token: string): Promise<InviteLink> {
  const { data, response } = await (await getApi()).GET("/invites/{token}", { params: { path: { token } } });
  if (response.status === 410) return { status: "expired" };
  if (response.status === 400 || response.status === 404) notFound();
  if (!data) throw unexpectedResponse(response);
  return { status: "open", invite: { ...data.invite, expiresAt: new Date(data.invite.expiresAt) } };
}
