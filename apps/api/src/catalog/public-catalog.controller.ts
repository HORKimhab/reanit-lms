import { Controller, Get, Inject, Param } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { CatalogService } from "@reanit/core/catalog";
import type { SchoolService } from "@reanit/core/schools";

import { Public } from "../auth/auth.decorators";
import { SCHOOL_SERVICE } from "../schools/schools.tokens";
import { CoursesResponse, CourseWithOutlineResponse, SchoolCatalogParams, SchoolCourseParams } from "./catalog.dto";
import { CATALOG_FOR_SCHOOL, type CatalogForSchool } from "./catalog.tokens";

/** A school site's catalog: published courses only, for anyone. */
@Public()
@Controller("schools/by-subdomain/:subdomain/courses")
export class PublicCatalogController {
  /**
   * Receives the school lookup and the factory for per-school catalogs.
   *
   * @param schools Resolves a subdomain to its school.
   * @param catalogFor Builds a catalog limited to one school.
   */
  constructor(
    @Inject(SCHOOL_SERVICE) private readonly schools: SchoolService,
    @Inject(CATALOG_FOR_SCHOOL) private readonly catalogFor: CatalogForSchool,
  ) {}

  /**
   * Picks the catalog of the school a subdomain belongs to.
   *
   * @param subdomain The school's subdomain.
   * @returns That school's catalog.
   * @throws {SchoolNotFoundError} When no school has the subdomain.
   */
  private async catalog(subdomain: string): Promise<CatalogService> {
    return this.catalogFor((await this.schools.getSchoolBySubdomain(subdomain)).id);
  }

  /**
   * Lists the school's published courses, newest first.
   *
   * @param params The school's subdomain.
   * @returns The courses.
   * @throws {SchoolNotFoundError} When no school has the subdomain (404).
   */
  @Get()
  @ApiOkResponse({ type: CoursesResponse })
  async list(@Param() params: SchoolCatalogParams): Promise<CoursesResponse> {
    return { courses: await (await this.catalog(params.subdomain)).listPublishedCourses() };
  }

  /**
   * Loads a published course with its outline, for its sales page.
   *
   * @param params The school's subdomain and the course's slug.
   * @returns The course.
   * @throws {SchoolNotFoundError} When no school has the subdomain (404).
   * @throws {CourseNotFoundError} When the school has no published course with the slug (404).
   */
  @Get(":slug")
  @ApiOkResponse({ type: CourseWithOutlineResponse })
  async get(@Param() params: SchoolCourseParams): Promise<CourseWithOutlineResponse> {
    return { course: await (await this.catalog(params.subdomain)).getPublishedCourse(params.slug) };
  }
}
