import { pageWindow } from "../shared/paging";
import type { AuditEntry, AuditStore, NewAuditEntry } from "./ports";
import type { AuditQuery } from "./rules";

/** Entries shown per page of the audit log. */
export const AUDIT_PAGE_SIZE = 50;

/** One page of a school's audit log. */
export interface AuditPage {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Builds one school's audit log use cases: record what staff did, and read it back.
 *
 * @param dependencies The school's log.
 * @param dependencies.store Persistence for the school's audit entries.
 * @returns The audit operations.
 * @example
 * const audit = createAuditLog({ store: createAuditStore(db, schoolId) });
 * await audit.record({ actorId: user.id, action: "course.update", targetId: course.id, requestId });
 */
export function createAuditLog({ store }: { store: AuditStore }) {
  return {
    /**
     * Records a staff action that succeeded.
     *
     * @param entry Who did what to which target, in which request.
     */
    async record(entry: NewAuditEntry): Promise<void> {
      await store.append(entry);
    },

    /**
     * Lists one page of the log, newest first.
     *
     * @param query The page.
     * @param query.page 1-based page; past the last one it is empty.
     * @returns The page's entries and how many there are in all.
     */
    async listEntries({ page }: AuditQuery): Promise<AuditPage> {
      const { entries, total } = await store.list(pageWindow(page, AUDIT_PAGE_SIZE));
      return { entries, total, page, pageSize: AUDIT_PAGE_SIZE };
    },
  };
}

/** One school's audit log use cases. */
export type AuditLog = ReturnType<typeof createAuditLog>;
