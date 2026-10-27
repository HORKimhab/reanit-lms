import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";

import { CurrentSchool, Roles, type StaffSchool } from "./schools.decorators";
import { StudentsQuery, StudentsResponse } from "./schools.dto";
import { STUDENTS_FOR_SCHOOL, type StudentsForSchool } from "./schools.tokens";

/** The caller's school's students, for the dashboard's students list. */
@Controller("students")
@Roles("owner", "admin", "instructor")
export class StudentsController {
  /**
   * Receives the factory for per-school students lists.
   *
   * @param studentsFor Builds a students list limited to one school.
   */
  constructor(@Inject(STUDENTS_FOR_SCHOOL) private readonly studentsFor: StudentsForSchool) {}

  /**
   * Lists one page of the school's students, optionally searched by name or email.
   *
   * @param school The caller's school.
   * @param query The search and 1-based page.
   * @returns The page's students, newest first, and how many match.
   */
  @Get()
  @ApiOkResponse({ type: StudentsResponse })
  async list(@CurrentSchool() school: StaffSchool, @Query() query: StudentsQuery): Promise<StudentsResponse> {
    const page = await this.studentsFor(school.id).searchStudents(query);
    return { ...page, students: page.students.map((student) => ({ ...student, joinedAt: student.joinedAt.toISOString() })) };
  }
}
