import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Res } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { SESSION_COOKIE, type AccountService, type AuthUser } from "@reanit/core/auth";
import { ENV } from "@reanit/nest";
import type { FastifyReply } from "fastify";

import type { Env } from "../config/env";
import { CurrentUser } from "./auth.decorators";
import { DataExportResponse, DeleteAccountBody } from "./auth.dto";
import { ACCOUNT_SERVICE } from "./auth.tokens";
import { sessionCookieOptions } from "./session-cookie";

/** Characters of the export time in its file name: the date, `YYYY-MM-DD`. */
const FILE_DATE_LENGTH = 10;

/** The signed-in person's data rights (GDPR): a copy of their data, and deleting their account, over `@reanit/core/auth`. */
@Controller("me")
export class AccountController {
  /**
   * Receives the account use cases and the environment.
   *
   * @param account The account use cases.
   * @param env Validated environment, for the session cookie's settings.
   */
  constructor(
    @Inject(ACCOUNT_SERVICE) private readonly account: AccountService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Downloads everything stored about the signed-in person, across every school, as a JSON file.
   *
   * @param user The signed-in person.
   * @param reply The response, to name the download.
   * @returns Their data, with dates as ISO strings.
   */
  @Get("data-export")
  @ApiOkResponse({ type: DataExportResponse })
  async exportData(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) reply: FastifyReply): Promise<DataExportResponse> {
    const data = await this.account.exportData(user.id);
    void reply.header("content-disposition", `attachment; filename="reanit-data-${data.exportedAt.toISOString().slice(0, FILE_DATE_LENGTH)}.json"`);
    // The export is a JSON document: writing it out turns its dates into ISO strings, as the response type says.
    return JSON.parse(JSON.stringify(data)) as DataExportResponse;
  }

  /**
   * Deletes the signed-in person's account once they type its email, and signs them out.
   *
   * @param user The signed-in person.
   * @param body The email typed to confirm.
   * @param reply The response, to clear the session cookie.
   * @throws {DeletionNotConfirmedError} When the typed email is not the account's (400).
   * @throws {AccountRunsSchoolError} When the person helps run a school (409).
   */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@CurrentUser() user: AuthUser, @Body() body: DeleteAccountBody, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.account.deleteAccount(user, body);
    void reply.clearCookie(SESSION_COOKIE, sessionCookieOptions(this.env.APP_URL));
  }
}
