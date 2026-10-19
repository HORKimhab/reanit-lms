import { describe, expect, it } from "vitest";

import { FakeAuditStore } from "../test/audit-fakes";
import { AUDIT_PAGE_SIZE, createAuditLog } from "./service";

const ENTRY = { actorId: "user-1", action: "course.update" as const, targetId: "course-1", requestId: "req-1" };

describe("record", () => {
  it("stores who did what to which target", async () => {
    const store = new FakeAuditStore();

    await createAuditLog({ store }).record(ENTRY);

    expect(store.entries).toEqual([expect.objectContaining({ actor: expect.objectContaining({ id: "user-1" }), action: "course.update", targetId: "course-1", requestId: "req-1" })]);
  });
});

describe("listEntries", () => {
  it("returns a page of the newest entries with the total", async () => {
    const store = new FakeAuditStore();
    const audit = createAuditLog({ store });
    await audit.record(ENTRY);
    await audit.record({ ...ENTRY, action: "course.delete" });

    const page = await audit.listEntries({ page: 1 });

    expect(page).toMatchObject({ total: 2, page: 1, pageSize: AUDIT_PAGE_SIZE });
    expect(page.entries.map((entry) => entry.action)).toEqual(["course.delete", "course.update"]);
  });

  it("skips the earlier pages", async () => {
    const store = new FakeAuditStore();

    await createAuditLog({ store }).listEntries({ page: 2 });

    expect(store.lastWindow).toEqual({ limit: AUDIT_PAGE_SIZE, offset: AUDIT_PAGE_SIZE });
  });
});
