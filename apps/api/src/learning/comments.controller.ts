import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { AuthUser } from "@reanit/core/auth";

import { Audited, pathParam } from "../audit/audit.decorator";
import { CurrentUser } from "../auth/auth.decorators";
import type { RequestContext } from "../context/request-context";
import { RateLimit } from "../rate-limit/rate-limit";
import { CurrentSchool, Roles } from "../schools/schools.decorators";
import {
  CommentInboxQuery,
  CommentInboxResponse,
  CommentParams,
  CommentResponse,
  CommentThreadsResponse,
  ModerationBody,
  QuizLessonParams,
  ReplyBody,
  toCommentResponse,
  toThreadResponse,
} from "./learning.dto";
import { COMMENT_MODERATION_FOR_SCHOOL, type CommentModerationForSchool } from "./learning.tokens";

/** The staff school `@Roles` resolved for the request. */
type StaffSchool = NonNullable<RequestContext["school"]>;

/** Staff side of lesson comments: the inbox, a lesson's threads, replies and moderation. */
@Controller()
@Roles("owner", "admin", "instructor")
export class CommentsController {
  /**
   * Receives the factory for per-school comment moderation.
   *
   * @param moderationFor Builds the staff side of comments for one school.
   */
  constructor(@Inject(COMMENT_MODERATION_FOR_SCHOOL) private readonly moderationFor: CommentModerationForSchool) {}

  /**
   * Lists one page of the school's threads, newest first: unanswered ones by default.
   *
   * @param school The caller's school.
   * @param query The page and filter.
   * @returns The page, hidden threads included.
   */
  @Get("comments")
  @ApiOkResponse({ type: CommentInboxResponse })
  async inbox(@CurrentSchool() school: StaffSchool, @Query() query: CommentInboxQuery): Promise<CommentInboxResponse> {
    const page = await this.moderationFor(school.id).listInbox(query);
    return { ...page, threads: page.threads.map(toThreadResponse) };
  }

  /**
   * Lists a lesson's threads for staff, hidden ones included.
   *
   * @param school The caller's school.
   * @param params The lesson's id.
   * @returns The threads.
   */
  @Get("lessons/:lessonId/comments")
  @ApiOkResponse({ type: CommentThreadsResponse })
  async lessonComments(@CurrentSchool() school: StaffSchool, @Param() params: QuizLessonParams): Promise<CommentThreadsResponse> {
    return { threads: (await this.moderationFor(school.id).listLessonComments(params.lessonId)).map(toThreadResponse) };
  }

  /**
   * Replies to a thread as the signed-in staff member.
   *
   * @param school The caller's school.
   * @param params The comment replied to.
   * @param body The reply.
   * @param user The staff member.
   * @returns The reply.
   * @throws {CommentNotFoundError} When the school has no such comment (404).
   */
  @Post("comments/:id/replies")
  @RateLimit("comment")
  @Audited("comment.reply", pathParam("id"))
  @ApiCreatedResponse({ type: CommentResponse })
  async reply(@CurrentSchool() school: StaffSchool, @Param() params: CommentParams, @Body() body: ReplyBody, @CurrentUser() user: AuthUser): Promise<CommentResponse> {
    return { comment: toCommentResponse(await this.moderationFor(school.id).reply(user.id, params.id, body.body)) };
  }

  /**
   * Hides a comment from students, or shows it again.
   *
   * @param school The caller's school.
   * @param params The comment.
   * @param body Whether it is hidden.
   * @throws {CommentNotFoundError} When the school has no such comment (404).
   */
  @Patch("comments/:id")
  @Audited("comment.moderate", pathParam("id"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async moderate(@CurrentSchool() school: StaffSchool, @Param() params: CommentParams, @Body() body: ModerationBody) {
    await this.moderationFor(school.id).setHidden(params.id, body.isHidden);
  }
}
