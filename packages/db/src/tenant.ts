import { z } from "zod";
import type { DbClient } from "./client";

const schoolIdSchema = z.uuid();

/**
 * Scopes a client to one school. Every model query runs in its own transaction as the
 * `reanit_app` role with `app.school_id` set, so the RLS policies from the init migration
 * hide and reject rows of every other school.
 *
 * @param db Unscoped client from `createDbClient`.
 * @param schoolId Id of the school the request belongs to.
 * @returns A client with the same model API, limited to that school's rows.
 * @throws {z.ZodError} When `schoolId` is not a UUID.
 * @example
 * const courses = await forSchool(db, school.id).course.findMany();
 */
export function forSchool(db: DbClient, schoolId: string) {
  const tenantId = schoolIdSchema.parse(schoolId);
  return db.$extends({
    query: {
      $allModels: {
        /**
         * Runs one model operation inside the tenant transaction.
         *
         * @param operation Prisma's operation context.
         * @param operation.args Arguments of the original query.
         * @param operation.query Runs the original query with those arguments.
         * @returns The original query's result.
         */
        async $allOperations({ args, query }) {
          const [, , result] = await db.$transaction([
            db.$executeRaw`SET LOCAL ROLE reanit_app`,
            db.$executeRaw`SELECT set_config('app.school_id', ${tenantId}, true)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

/** Client returned by `forSchool`. */
export type TenantClient = ReturnType<typeof forSchool>;
