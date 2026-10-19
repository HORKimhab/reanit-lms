import type { StudentService } from "@reanit/core/schools";

/** Injection token for the `SchoolService` from `@reanit/core/schools`. */
export const SCHOOL_SERVICE = Symbol("SCHOOL_SERVICE");

/** Injection token for `StudentsForSchool`. */
export const STUDENTS_FOR_SCHOOL = Symbol("STUDENTS_FOR_SCHOOL");

/** Builds one school's students list on the tenant client. */
export type StudentsForSchool = (schoolId: string) => StudentService;
