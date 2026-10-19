import type { DbClient } from "./client";
import { forSchool } from "./tenant";

/** Actions the audit log records; matches `AuditAction` in `@reanit/core/audit`. */
type AuditAction =
  | "course.create"
  | "course.update"
  | "course.delete"
  | "course.outline.save"
  | "course.price.set"
  | "coupon.create"
  | "coupon.delete"
  | "lesson.media.attach"
  | "school.settings.update";

/**
 * One school's audit log. Every query goes through the tenant client, so a school sees and writes
 * only its own entries; it satisfies `AuditStore` from `@reanit/core/audit`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @param schoolId The school whose log this is.
 * @returns The store operations.
 * @throws {z.ZodError} When `schoolId` is not a UUID.
 * @example
 * const audit = createAuditLog({ store: createAuditStore(db, school.id) });
 */
export function createAuditStore(db: DbClient, schoolId: string) {
  const tenant = forSchool(db, schoolId);

  return {
    /**
     * Writes an entry.
     *
     * @param entry Who did what to which target, in which request.
     * @param entry.actorId Who did it.
     * @param entry.action What they did.
     * @param entry.targetId What they did it to.
     * @param entry.requestId The request.
     */
    async append({ actorId, action, targetId, requestId }: { actorId: string; action: AuditAction; targetId: string; requestId: string }) {
      await tenant.auditEvent.create({ data: { schoolId, actorId, action, targetId, requestId } });
    },

    /**
     * Lists a window of the log, newest first, with who did each action.
     *
     * @param window Rows to return and skip.
     * @param window.limit Rows to return.
     * @param window.offset Rows to skip.
     * @returns The entries and how many there are in all.
     */
    async list({ limit, offset }: { limit: number; offset: number }) {
      const [rows, total] = await Promise.all([
        tenant.auditEvent.findMany({
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: limit,
          skip: offset,
          select: { id: true, action: true, targetId: true, requestId: true, createdAt: true, actor: { select: { id: true, email: true, name: true } } },
        }),
        tenant.auditEvent.count(),
      ]);
      return { entries: rows.map((row) => ({ ...row, action: row.action as AuditAction })), total };
    },
  };
}
