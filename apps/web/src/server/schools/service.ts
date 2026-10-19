import { createSchoolService, type SchoolService } from "@reanit/core/schools";
import { createSchoolStore } from "@reanit/db";

import { getDb } from "../db";

let service: SchoolService | undefined;

/**
 * Wires the school use cases to Postgres.
 *
 * @returns The shared school service.
 * @throws {z.ZodError} When `DATABASE_URL` is missing.
 */
export function getSchoolService(): SchoolService {
  service ??= createSchoolService({ store: createSchoolStore(getDb()) });
  return service;
}
