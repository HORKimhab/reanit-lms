// In-memory fake of the audit port, for unit tests of the audit log.
import type { AuditEntry, AuditStore, NewAuditEntry } from "../audit";

/** In-memory `AuditStore` for one school, newest entry first. */
export class FakeAuditStore implements AuditStore {
  readonly entries: AuditEntry[] = [];
  /** The window `list` was last called with. */
  lastWindow: { limit: number; offset: number } | null = null;

  /**
   * Stores an entry with a sequential id and no actor details.
   *
   * @param entry The entry.
   * @param entry.actorId Who did it.
   * @param entry.action What they did.
   * @param entry.targetId What they did it to.
   * @param entry.requestId The request.
   */
  async append({ actorId, action, targetId, requestId }: NewAuditEntry) {
    this.entries.unshift({
      id: `audit-${this.entries.length + 1}`,
      actor: { id: actorId, email: `${actorId}@example.com`, name: null },
      action,
      targetId,
      requestId,
      createdAt: new Date("2026-10-19T00:00:00Z"),
    });
  }

  /**
   * Lists a window of the entries.
   *
   * @param window Rows to return and skip.
   * @param window.limit Rows to return.
   * @param window.offset Rows to skip.
   * @returns The entries in the window and how many there are.
   */
  async list(window: { limit: number; offset: number }) {
    this.lastWindow = window;
    return { entries: this.entries.slice(window.offset, window.offset + window.limit), total: this.entries.length };
  }
}
