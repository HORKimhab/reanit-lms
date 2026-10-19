import type { AuditLog } from "@reanit/core/audit";

/** Injection token for `AuditFor`. */
export const AUDIT_FOR_SCHOOL = Symbol("AUDIT_FOR_SCHOOL");

/** Builds one school's audit log on the tenant client. */
export type AuditFor = (schoolId: string) => AuditLog;
