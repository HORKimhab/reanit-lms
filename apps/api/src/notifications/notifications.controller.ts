import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Put } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { AuthUser } from "@reanit/core/auth";
import type { NotificationPreferenceService } from "@reanit/core/notifications";

import { CurrentUser, Public } from "../auth/auth.decorators";
import { CurrentSchool, Roles, type StaffSchool } from "../schools/schools.decorators";
import { NotificationPreferencesBody, NotificationPreferencesResponse, UnsubscribeBody, UnsubscribeResponse } from "./notifications.dto";
import { NOTIFICATION_PREFERENCES } from "./notifications.tokens";

/** Staff members' email settings, and the unsubscribe link every staff email carries, over `@reanit/core/notifications`. */
@Controller("notifications")
export class NotificationsController {
  /**
   * Receives the email settings use cases.
   *
   * @param preferences The email settings use cases.
   */
  constructor(@Inject(NOTIFICATION_PREFERENCES) private readonly preferences: NotificationPreferenceService) {}

  /**
   * Reads the caller's email settings for their school.
   *
   * @param current The caller's school.
   * @param user The caller.
   * @returns Their settings; every email, in English, until they save any.
   */
  @Get("preferences")
  @Roles("owner", "admin", "instructor")
  @ApiOkResponse({ type: NotificationPreferencesResponse })
  async get(@CurrentSchool() current: StaffSchool, @CurrentUser() user: AuthUser): Promise<NotificationPreferencesResponse> {
    return { preferences: await this.preferences.getPreferences(current.id, user.id) };
  }

  /**
   * Saves the caller's email settings for their school. Personal, so not in the audit log.
   *
   * @param current The caller's school.
   * @param user The caller.
   * @param body Each staff email on or off, and their language.
   * @returns The saved settings.
   */
  @Put("preferences")
  @Roles("owner", "admin", "instructor")
  @ApiOkResponse({ type: NotificationPreferencesResponse })
  async save(
    @CurrentSchool() current: StaffSchool,
    @CurrentUser() user: AuthUser,
    @Body() body: NotificationPreferencesBody,
  ): Promise<NotificationPreferencesResponse> {
    return { preferences: await this.preferences.savePreferences(current.id, user.id, body) };
  }

  /**
   * Stops one kind of staff email from an unsubscribe link, signed in or not: the token stands in for the reader.
   *
   * @param body The link's token and kind of email.
   * @returns The name of the school the emails were about.
   * @throws {InvalidUnsubscribeLinkError} When no staff member has the token (404).
   */
  @Public()
  @Post("unsubscribe")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: UnsubscribeResponse })
  unsubscribe(@Body() body: UnsubscribeBody): Promise<UnsubscribeResponse> {
    return this.preferences.unsubscribe(body);
  }
}
