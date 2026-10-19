import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Put } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { AuthUser } from "@reanit/core/auth";
import type { LearningService } from "@reanit/core/learning";
import type { SchoolService } from "@reanit/core/schools";

import { CurrentUser } from "../auth/auth.decorators";
import { PlaybackResponse } from "../media/media.dto";
import { SCHOOL_SERVICE } from "../schools/schools.tokens";
import { PlayerCourseParams, PlayerCourseResponse, PlayerLessonParams, ProgressBody } from "./learning.dto";
import { LEARNING_FOR_SCHOOL, type LearningForSchool } from "./learning.tokens";

/** The student player on a school site: the course, lesson files and progress, for enrolled students only. */
@Controller("schools/by-subdomain/:subdomain")
export class LearningController {
  /**
   * Receives the school lookup and the factory for per-school learning services.
   *
   * @param schools Resolves a subdomain to its school.
   * @param learningFor Builds a learning service limited to one school.
   */
  constructor(
    @Inject(SCHOOL_SERVICE) private readonly schools: SchoolService,
    @Inject(LEARNING_FOR_SCHOOL) private readonly learningFor: LearningForSchool,
  ) {}

  /**
   * Picks the learning service of the school a subdomain belongs to.
   *
   * @param subdomain The school's subdomain.
   * @returns That school's learning service.
   * @throws {SchoolNotFoundError} When no school has the subdomain.
   */
  private async learning(subdomain: string): Promise<LearningService> {
    return this.learningFor((await this.schools.getSchoolBySubdomain(subdomain)).id);
  }

  /**
   * Loads a course for the player.
   *
   * @param params The school's subdomain and the course's slug.
   * @param user The signed-in student.
   * @returns The course with its outline and the student's progress.
   * @throws {CourseNotFoundError} When the school has no such course (404).
   * @throws {NotEnrolledError} When the student has no current enrollment in it (403).
   */
  @Get("learn/:slug")
  @ApiOkResponse({ type: PlayerCourseResponse })
  async course(@Param() params: PlayerCourseParams, @CurrentUser() user: AuthUser): Promise<PlayerCourseResponse> {
    return { course: await (await this.learning(params.subdomain)).getCourse(user.id, params.slug) };
  }

  /**
   * Signs a URL to play or download a lesson's file.
   *
   * @param params The school's subdomain and the lesson's id.
   * @param user The signed-in student.
   * @returns The URL and when it expires.
   * @throws {NotEnrolledError} When the student cannot open the lesson (403).
   * @throws {LessonMediaMissingError} When no file is attached (404).
   */
  @Get("lessons/:lessonId/media")
  @ApiOkResponse({ type: PlaybackResponse })
  async media(@Param() params: PlayerLessonParams, @CurrentUser() user: AuthUser): Promise<PlaybackResponse> {
    const { url, expiresAt } = await (await this.learning(params.subdomain)).getLessonMedia(user.id, params.lessonId);
    return { url, expiresAt: expiresAt.toISOString() };
  }

  /**
   * Saves the player's heartbeat (video position) or a completed lesson.
   *
   * @param params The school's subdomain and the lesson's id.
   * @param body The position, completion, or both.
   * @param user The signed-in student.
   * @throws {NotEnrolledError} When the student cannot open the lesson (403).
   */
  @Put("lessons/:lessonId/progress")
  @HttpCode(HttpStatus.NO_CONTENT)
  async progress(@Param() params: PlayerLessonParams, @Body() body: ProgressBody, @CurrentUser() user: AuthUser) {
    await (await this.learning(params.subdomain)).recordProgress(user.id, params.lessonId, body);
  }
}
