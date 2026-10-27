import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { AuthUser } from "@reanit/core/auth";
import { INVITE_DAYS } from "@reanit/core/schools";
import { composeTeamInviteEmail } from "@reanit/email";
import { ENV } from "@reanit/nest";

import { Audited, pathParam } from "../audit/audit.decorator";
import { CurrentUser } from "../auth/auth.decorators";
import type { Env } from "../config/env";
import { CurrentSchool, Roles, type StaffSchool } from "./schools.decorators";
import {
  ChangeRoleBody,
  InviteBody,
  MemberParams,
  TeamInviteResponse,
  TeamMemberResponse,
  TeamResponse,
  toTeamInviteResponse,
  toTeamMemberResponse,
} from "./schools.dto";
import { TEAM_FOR_SCHOOL, type TeamForSchool } from "./schools.tokens";

/**
 * Builds the web app's page that accepts an invite.
 *
 * @param appUrl The web app's origin.
 * @param token The invite's token.
 * @returns The link the invite email carries.
 */
export function inviteUrl(appUrl: string, token: string): string {
  return new URL(`/invite/${token}`, appUrl).href;
}

/** The school's team, for its owner and admins: the staff and invites, inviting, changing roles and removing members. */
@Controller("team")
@Roles("owner", "admin")
export class TeamController {
  /**
   * Receives the factory for per-school team services and the environment.
   *
   * @param teamFor Builds a team service limited to one school.
   * @param env Validated environment, for the web app's origin in invite links.
   */
  constructor(
    @Inject(TEAM_FOR_SCHOOL) private readonly teamFor: TeamForSchool,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Lists the school's staff and the invites not accepted yet.
   *
   * @param school The caller's school.
   * @returns The members, owner first, and the invites, newest first.
   */
  @Get()
  @ApiOkResponse({ type: TeamResponse })
  async list(@CurrentSchool() school: StaffSchool): Promise<TeamResponse> {
    const { members, invites } = await this.teamFor(school.id).listTeam();
    return { members: members.map(toTeamMemberResponse), invites: invites.map(toTeamInviteResponse) };
  }

  /**
   * Invites someone to the team as an admin or instructor and emails them the link. Inviting the
   * same email again sends a new link and the old one stops working.
   *
   * @param school The caller's school.
   * @param user The signed-in staff member, named in the email.
   * @param body The email, the role and the email's language.
   * @returns The invite.
   * @throws {AlreadyTeamMemberError} When the email already belongs to the team (409).
   */
  @Post("invites")
  @Audited("team.invite", ({ response }) => (response as TeamInviteResponse).invite.id)
  @ApiCreatedResponse({ type: TeamInviteResponse })
  async invite(@CurrentSchool() school: StaffSchool, @CurrentUser() user: AuthUser, @Body() body: InviteBody): Promise<TeamInviteResponse> {
    const invite = await this.teamFor(school.id).inviteMember(body, (token) =>
      composeTeamInviteEmail({ locale: body.locale, url: inviteUrl(this.env.APP_URL, token), school: school.name, inviter: user.name, role: body.role, days: INVITE_DAYS }),
    );
    return { invite: toTeamInviteResponse(invite) };
  }

  /**
   * Gives a member another role.
   *
   * @param school The caller's school.
   * @param params The member's user id.
   * @param body The new role.
   * @returns The member.
   * @throws {TeamMemberNotFoundError} When the user is not on the team (404).
   * @throws {OwnerLockedError} When the user is the owner (409).
   */
  @Patch("members/:id")
  @Audited("team.member.update", pathParam("id"))
  @ApiOkResponse({ type: TeamMemberResponse })
  async changeRole(@CurrentSchool() school: StaffSchool, @Param() params: MemberParams, @Body() body: ChangeRoleBody): Promise<TeamMemberResponse> {
    return { member: toTeamMemberResponse(await this.teamFor(school.id).changeRole(params.id, body.role)) };
  }

  /**
   * Removes a member from the team.
   *
   * @param school The caller's school.
   * @param params The member's user id.
   * @throws {TeamMemberNotFoundError} When the user is not on the team (404).
   * @throws {OwnerLockedError} When the user is the owner (409).
   */
  @Delete("members/:id")
  @Audited("team.member.remove", pathParam("id"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentSchool() school: StaffSchool, @Param() params: MemberParams) {
    await this.teamFor(school.id).removeMember(params.id);
  }
}
