import { Controller, Get, HttpCode, HttpStatus, Inject, Param, Post } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { AuthUser } from "@reanit/core/auth";
import type { InviteAcceptance } from "@reanit/core/schools";

import { Audited } from "../audit/audit.decorator";
import { CurrentUser, Public } from "../auth/auth.decorators";
import { AcceptedInviteResponse, InvitePreviewResponse, InviteTokenParams } from "./schools.dto";
import { INVITE_ACCEPTANCE } from "./schools.tokens";

/**
 * Finds the school an accepted invite joined, for its audit entry.
 *
 * @param response The accept route's response.
 * @returns The school's id.
 */
function joinedSchool(response: unknown): string {
  return (response as AcceptedInviteResponse).school.id;
}

/** Invite links: what one is for, and accepting it. */
@Controller("invites/:token")
export class InvitesController {
  /**
   * Receives the invite use cases.
   *
   * @param invites Finds and accepts invites by token.
   */
  constructor(@Inject(INVITE_ACCEPTANCE) private readonly invites: InviteAcceptance) {}

  /**
   * Shows what an invite link is for, so the page can say it before the visitor signs in.
   *
   * @param params The token from the link.
   * @returns The school, the role and the invited email.
   * @throws {InviteNotFoundError} When no invite has the token (404).
   * @throws {InviteExpiredError} When the invite expired (410).
   */
  @Public()
  @Get()
  @ApiOkResponse({ type: InvitePreviewResponse })
  async preview(@Param() params: InviteTokenParams): Promise<InvitePreviewResponse> {
    const invite = await this.invites.getInvite(params.token);
    return { invite: { ...invite, expiresAt: invite.expiresAt.toISOString() } };
  }

  /**
   * Accepts an invite: the signed-in user joins the school's team with its role.
   *
   * @param params The token from the link.
   * @param user The signed-in user; their email must be the invited one.
   * @returns The school they joined and their role.
   * @throws {InviteNotFoundError} When no invite has the token (404).
   * @throws {InviteExpiredError} When the invite expired (410).
   * @throws {InviteEmailMismatchError} When the user's email is not the invited one (403).
   */
  @Post("accept")
  @HttpCode(HttpStatus.OK)
  @Audited("team.invite.accept", ({ schoolId }) => schoolId, joinedSchool)
  @ApiOkResponse({ type: AcceptedInviteResponse })
  async accept(@Param() params: InviteTokenParams, @CurrentUser() user: AuthUser): Promise<AcceptedInviteResponse> {
    return this.invites.acceptInvite(params.token, user);
  }
}
