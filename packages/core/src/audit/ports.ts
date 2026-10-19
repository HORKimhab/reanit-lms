import type { AuditAction } from "./rules";

/** What a staff member did, as it is written. */
export interface NewAuditEntry {
  actorId: string;
  action: AuditAction;
  /** The id of what was acted on: a course, a lesson, the school. */
  targetId: string;
  /** The request that did it, to find its logs. */
  requestId: string;
}

/** A recorded action, as the log lists it. */
export interface AuditEntry {
  id: string;
  /** Who did it; null when their account has since been deleted. */
  actor: { id: string; email: string; name: string | null } | null;
  action: AuditAction;
  targetId: string;
  requestId: string;
  createdAt: Date;
}

/** One school's audit log. `@reanit/db` implements it with `createAuditStore`. */
export interface AuditStore {
  append(entry: NewAuditEntry): Promise<void>;
  /** One page of entries, newest first, with how many there are. */
  list(page: { limit: number; offset: number }): Promise<{ entries: AuditEntry[]; total: number }>;
}
