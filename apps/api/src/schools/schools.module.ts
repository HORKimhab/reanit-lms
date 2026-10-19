import { randomUUID } from "node:crypto";

import { Module } from "@nestjs/common";
import type { ObjectStorage } from "@reanit/core/media";
import { createSchoolService, createStudentService } from "@reanit/core/schools";
import { createSchoolStore, createStudentStore, type DbClient } from "@reanit/db";
import { DB_CLIENT } from "@reanit/nest";

import { systemClock } from "../context/clock";
import { OBJECT_STORAGE, StorageModule } from "../storage/storage.module";
import { RolesGuard } from "./roles.guard";
import { SchoolsController } from "./schools.controller";
import { SCHOOL_SERVICE, STUDENTS_FOR_SCHOOL, type StudentsForSchool } from "./schools.tokens";
import { StudentsController } from "./students.controller";

/**
 * Wires the school use cases to Postgres and object storage.
 *
 * @param db The shared database client.
 * @param storage Object storage holding the logos.
 * @returns The school service.
 */
function provideSchoolService(db: DbClient, storage: ObjectStorage) {
  return createSchoolService({ store: createSchoolStore(db), storage, clock: systemClock, newId: randomUUID });
}

/**
 * Wires per-school students lists to Postgres through the tenant client.
 *
 * @param db The shared database client.
 * @returns A factory of students services limited to one school.
 */
function provideStudentsForSchool(db: DbClient): StudentsForSchool {
  return (schoolId) => createStudentService({ store: createStudentStore(db, schoolId) });
}

/** School routes and settings, the students list, and `RolesGuard` for any module whose routes use `@Roles(...)`. */
@Module({
  imports: [StorageModule],
  controllers: [SchoolsController, StudentsController],
  providers: [
    { provide: SCHOOL_SERVICE, inject: [DB_CLIENT, OBJECT_STORAGE], useFactory: provideSchoolService },
    { provide: STUDENTS_FOR_SCHOOL, inject: [DB_CLIENT], useFactory: provideStudentsForSchool },
    RolesGuard,
  ],
  exports: [SCHOOL_SERVICE, RolesGuard],
})
export class SchoolsModule {}
