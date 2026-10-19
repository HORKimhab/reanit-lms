import { z } from "zod";

import { pageSchema } from "../shared/paging";

/** Staff actions the audit log records, named `<thing>.<what was done>`. */
export const AUDIT_ACTIONS = [
  "course.create",
  "course.update",
  "course.delete",
  "course.outline.save",
  "course.price.set",
  "coupon.create",
  "coupon.delete",
  "bundle.create",
  "bundle.update",
  "bundle.price.set",
  "lesson.media.attach",
  "lesson.quiz.save",
  "school.settings.update",
] as const;

/** A recorded staff action. */
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Audit log query: a 1-based page. */
export const auditQuerySchema = z.object({ page: pageSchema });

/** Parsed audit log query. */
export type AuditQuery = z.infer<typeof auditQuerySchema>;
