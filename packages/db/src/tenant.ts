import { z } from "zod";

import type { DbClient } from "./client";
import type { Prisma } from "./generated/prisma/client";

const schoolIdSchema = z.uuid();

/** Client inside `inSchoolTransaction`; every query on it is limited to that school. */
export type SchoolTransaction = Prisma.TransactionClient;

/**
 * Statements that make the rest of the current transaction run as the `reanit_app` role
 * with `app.school_id` set, so the RLS policies from the init migration apply.
 *
 * @param client Client or transaction to run them on.
 * @param schoolId Validated school id.
 * @returns The two statements, not yet run.
 */
function scopeToSchool(client: DbClient | SchoolTransaction, schoolId: string) {
  return [
    client.$executeRaw`SET LOCAL ROLE reanit_app`,
    client.$executeRaw`SELECT set_config('app.school_id', ${schoolId}, true)`,
  ] as const;
}

/**
 * Scopes a client to one school. Every model query runs in its own transaction as the
 * `reanit_app` role with `app.school_id` set, so RLS hides and rejects rows of every other school.
 * For several statements that must commit together, use `inSchoolTransaction`.
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
          const [, , result] = await db.$transaction([...scopeToSchool(db, tenantId), query(args)]);
          return result;
        },
      },
    },
  });
}

/** Client returned by `forSchool`. */
export type TenantClient = ReturnType<typeof forSchool>;

/**
 * Runs several statements as one school in a single transaction: all commit or none do.
 *
 * @param db Unscoped client from `createDbClient`.
 * @param schoolId Id of the school the work belongs to.
 * @param work Queries to run on the scoped transaction client.
 * @returns What `work` returns.
 * @throws {z.ZodError} When `schoolId` is not a UUID.
 * @throws {Error} Whatever `work` throws; the transaction is rolled back.
 * @example
 * await inSchoolTransaction(db, school.id, async (tx) => {
 *   await tx.section.deleteMany({ where: { courseId } });
 *   await tx.section.create({ data: section });
 * });
 */
export async function inSchoolTransaction<T>(
  db: DbClient,
  schoolId: string,
  work: (tx: SchoolTransaction) => Promise<T>,
): Promise<T> {
  const tenantId = schoolIdSchema.parse(schoolId);
  return db.$transaction(async (tx) => {
    for (const statement of scopeToSchool(tx, tenantId)) await statement;
    return work(tx);
  });
}
