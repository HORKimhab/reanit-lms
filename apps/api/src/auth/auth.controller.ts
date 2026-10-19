import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Query, Req, Res } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import {
  InvalidMagicLinkError,
  safeRedirectPath,
  SESSION_COOKIE,
  type AuthService,
  type AuthSession,
  type AuthUser,
} from "@reanit/core/auth";
import type { FastifyReply, FastifyRequest } from "fastify";

import { ENV, type Env } from "../config/env";
import { CurrentUser, Public } from "./auth.decorators";
import { LogInBody, MagicLinkBody, SessionResponse, SignUpBody, VerifyMagicLinkQuery } from "./auth.dto";
import { AUTH_SERVICE } from "./auth.tokens";
import { composeMagicLinkEmail } from "./magic-link-email";
import { sessionCookieOptions } from "./session-cookie";

/** Web login page with the error it shows for a bad magic link. */
export const INVALID_MAGIC_LINK_PATH = "/login?error=invalid-link";

/** Sign-up, login, magic link, logout and the current user, over `@reanit/core/auth`. */
@Controller("auth")
export class AuthController {
  /**
   * Receives the auth use cases and the environment.
   *
   * @param auth The auth use cases.
   * @param env Validated environment.
   */
  constructor(
    @Inject(AUTH_SERVICE) private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Stores a new session in the session cookie.
   *
   * @param reply The response to set the cookie on.
   * @param session The session to store.
   * @returns The response body for the session.
   */
  private startSession(reply: FastifyReply, session: AuthSession): SessionResponse {
    void reply.setCookie(SESSION_COOKIE, session.token, sessionCookieOptions(this.env.APP_URL, session.expiresAt));
    return { user: session.user };
  }

  /**
   * Creates a password account and signs it in.
   *
   * @param body Name, email and password.
   * @param reply The response, to set the session cookie.
   * @returns The new user.
   * @throws {EmailTakenError} When the email already has an account (409).
   */
  @Public()
  @Post("sign-up")
  @ApiCreatedResponse({ type: SessionResponse })
  async signUp(@Body() body: SignUpBody, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.startSession(reply, await this.auth.signUp(body));
  }

  /**
   * Signs in with email and password.
   *
   * @param body Email and password.
   * @param reply The response, to set the session cookie.
   * @returns The user.
   * @throws {InvalidCredentialsError} When the email or password is wrong (401).
   */
  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SessionResponse })
  async logIn(@Body() body: LogInBody, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.startSession(reply, await this.auth.logIn(body));
  }

  /**
   * Emails a one-time sign-in link. Answers the same whether or not the account exists.
   *
   * @param body Email, optional `next` path and email language.
   */
  @Public()
  @Post("magic-link")
  @HttpCode(HttpStatus.ACCEPTED)
  async requestMagicLink(@Body() body: MagicLinkBody) {
    const next = safeRedirectPath(body.next);
    await this.auth.requestMagicLink(body.email, (token) =>
      composeMagicLinkEmail({ appUrl: this.env.APP_URL, token, next, locale: body.locale }),
    );
  }

  /**
   * Signs in from the emailed link, then sends the browser on to `next`, or to the login page
   * when the link is bad. The browser follows a link here, so it answers with redirects, not JSON.
   *
   * @param query The link's `token` and `next`.
   * @param reply The response, to set the cookie and redirect.
   * @returns The redirect.
   */
  @Public()
  @Get("magic-link/verify")
  async verifyMagicLink(@Query() query: VerifyMagicLinkQuery, @Res() reply: FastifyReply) {
    try {
      if (!query.token) throw new InvalidMagicLinkError();
      this.startSession(reply, await this.auth.verifyMagicLink(query.token));
    } catch (error) {
      if (!(error instanceof InvalidMagicLinkError)) throw error;
      return reply.redirect(INVALID_MAGIC_LINK_PATH, HttpStatus.SEE_OTHER);
    }
    return reply.redirect(safeRedirectPath(query.next), HttpStatus.SEE_OTHER);
  }

  /**
   * Ends the current session, if any, and clears its cookie.
   *
   * @param request The request carrying the session cookie.
   * @param reply The response, to clear the cookie.
   */
  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logOut(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await this.auth.logOut(token);
    void reply.clearCookie(SESSION_COOKIE, sessionCookieOptions(this.env.APP_URL));
  }

  /**
   * Returns the signed-in user.
   *
   * @param user The user from the session.
   * @returns The user.
   */
  @Get("me")
  @ApiOkResponse({ type: SessionResponse })
  me(@CurrentUser() user: AuthUser): SessionResponse {
    return { user };
  }
}
