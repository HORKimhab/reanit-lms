import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Put } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";

import { Audited, pathParam } from "../audit/audit.decorator";
import type { RequestContext } from "../context/request-context";
import { CurrentSchool, Roles } from "../schools/schools.decorators";
import { AttachMediaBody, LessonParams, PlaybackResponse, UploadRequestBody, UploadResponse } from "./media.dto";
import { MEDIA_FOR_SCHOOL, type MediaForSchool } from "./media.tokens";

/** The staff school `@Roles` resolved for the request. */
type StaffSchool = NonNullable<RequestContext["school"]>;

/** A lesson's video or PDF: upload straight to storage, attach, and preview. Students play it through the learning routes. */
@Controller("lessons/:lessonId/media")
@Roles("owner", "admin", "instructor")
export class MediaController {
  /**
   * Receives the factory for per-school media services.
   *
   * @param mediaFor Builds a media service limited to one school.
   */
  constructor(@Inject(MEDIA_FOR_SCHOOL) private readonly mediaFor: MediaForSchool) {}

  /**
   * Presigns the upload of a lesson's file.
   *
   * @param school The caller's school.
   * @param params The lesson's id.
   * @param body The file's content type and size.
   * @returns The upload URL, the header to send, the key and when the URL expires.
   * @throws {LessonNotFoundError} When the school has no such lesson (404).
   * @throws {UnsupportedMediaError} When the lesson's type does not take that file (415).
   * @throws {MediaTooLargeError} When the file is too big (413).
   */
  @Post("uploads")
  @ApiCreatedResponse({ type: UploadResponse })
  async requestUpload(
    @CurrentSchool() school: StaffSchool,
    @Param() params: LessonParams,
    @Body() body: UploadRequestBody,
  ): Promise<UploadResponse> {
    const upload = await this.mediaFor(school.id).requestUpload(params.lessonId, body);
    return { ...upload, expiresAt: upload.expiresAt.toISOString() };
  }

  /**
   * Attaches an uploaded file to the lesson.
   *
   * @param school The caller's school.
   * @param params The lesson's id.
   * @param body The key the upload went to.
   * @throws {LessonNotFoundError} When the school has no such lesson (404).
   * @throws {InvalidMediaKeyError} When the key is not this lesson's (400).
   * @throws {MediaNotUploadedError} When the upload has not arrived (409).
   */
  @Put()
  @Audited("lesson.media.attach", pathParam("lessonId"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async attach(@CurrentSchool() school: StaffSchool, @Param() params: LessonParams, @Body() body: AttachMediaBody) {
    await this.mediaFor(school.id).attachMedia(params.lessonId, body.key);
  }

  /**
   * Signs a URL to preview the lesson's file.
   *
   * @param school The caller's school.
   * @param params The lesson's id.
   * @returns The URL and when it expires.
   * @throws {LessonNotFoundError} When the school has no such lesson (404).
   * @throws {LessonMediaMissingError} When no file is attached (404).
   */
  @Get()
  @ApiOkResponse({ type: PlaybackResponse })
  async playback(@CurrentSchool() school: StaffSchool, @Param() params: LessonParams): Promise<PlaybackResponse> {
    const { url, expiresAt } = await this.mediaFor(school.id).getPlaybackUrl(params.lessonId);
    return { url, expiresAt: expiresAt.toISOString() };
  }
}
