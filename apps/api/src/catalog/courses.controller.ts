import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post, Put } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { CatalogService } from "@reanit/core/catalog";

import { Audited, pathParam } from "../audit/audit.decorator";
import { CurrentSchool, Roles, type StaffSchool } from "../schools/schools.decorators";
import {
  CourseIdParams,
  CourseResponse,
  CoursesResponse,
  CourseSlugParams,
  CourseWithOutlineResponse,
  CreateCourseBody,
  OutlineBody,
  UpdateCourseBody,
} from "./catalog.dto";
import { CATALOG_FOR_SCHOOL, type CatalogForSchool } from "./catalog.tokens";

/** The course builder's routes: the caller's school's courses, drafts included, over the tenant client. */
@Controller("courses")
@Roles("owner", "admin", "instructor")
export class CoursesController {
  /**
   * Receives the factory for per-school catalogs.
   *
   * @param catalogFor Builds a catalog limited to one school.
   */
  constructor(@Inject(CATALOG_FOR_SCHOOL) private readonly catalogFor: CatalogForSchool) {}

  /**
   * Picks the catalog of the school the request acts on.
   *
   * @param school The caller's school.
   * @returns That school's catalog.
   */
  private catalog(school: StaffSchool): CatalogService {
    return this.catalogFor(school.id);
  }

  /**
   * Lists the school's courses, newest first.
   *
   * @param school The caller's school.
   * @returns The courses.
   */
  @Get()
  @ApiOkResponse({ type: CoursesResponse })
  async list(@CurrentSchool() school: StaffSchool): Promise<CoursesResponse> {
    return { courses: await this.catalog(school).listCourses() };
  }

  /**
   * Creates a draft course.
   *
   * @param school The caller's school.
   * @param body The title.
   * @returns The new course.
   */
  @Post()
  @Audited("course.create", ({ response }) => (response as CourseResponse).course.id)
  @ApiCreatedResponse({ type: CourseResponse })
  async create(@CurrentSchool() school: StaffSchool, @Body() body: CreateCourseBody): Promise<CourseResponse> {
    return { course: await this.catalog(school).createCourse(body) };
  }

  /**
   * Loads a course with its outline, for the builder.
   *
   * @param school The caller's school.
   * @param params The course's slug.
   * @returns The course.
   * @throws {CourseNotFoundError} When the school has no such course (404).
   */
  @Get("by-slug/:slug")
  @ApiOkResponse({ type: CourseWithOutlineResponse })
  async get(@CurrentSchool() school: StaffSchool, @Param() params: CourseSlugParams): Promise<CourseWithOutlineResponse> {
    return { course: await this.catalog(school).getCourse(params.slug) };
  }

  /**
   * Changes a course's title, description or status.
   *
   * @param school The caller's school.
   * @param params The course's id.
   * @param body The changes.
   * @returns The updated course.
   * @throws {CourseNotFoundError} When the school has no such course (404).
   */
  @Patch(":id")
  @Audited("course.update", pathParam("id"))
  @ApiOkResponse({ type: CourseResponse })
  async update(
    @CurrentSchool() school: StaffSchool,
    @Param() params: CourseIdParams,
    @Body() body: UpdateCourseBody,
  ): Promise<CourseResponse> {
    return { course: await this.catalog(school).updateCourse(params.id, body) };
  }

  /**
   * Deletes a course with its sections and lessons.
   *
   * @param school The caller's school.
   * @param params The course's id.
   * @throws {CourseNotFoundError} When the school has no such course (404).
   */
  @Delete(":id")
  @Audited("course.delete", pathParam("id"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentSchool() school: StaffSchool, @Param() params: CourseIdParams) {
    await this.catalog(school).deleteCourse(params.id);
  }

  /**
   * Saves the builder's outline in one go.
   *
   * @param school The caller's school.
   * @param params The course's id.
   * @param body The sections and lessons in order.
   * @throws {CourseNotFoundError} When the school has no such course (404).
   */
  @Put(":id/outline")
  @Audited("course.outline.save", pathParam("id"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async saveOutline(@CurrentSchool() school: StaffSchool, @Param() params: CourseIdParams, @Body() body: OutlineBody) {
    await this.catalog(school).saveOutline(params.id, body);
  }
}
