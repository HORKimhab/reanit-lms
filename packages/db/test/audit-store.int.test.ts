import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createAuditStore, createDbClient } from "../src";
import { openTestSchool } from "../src/test/schools";

const db = createDbClient(inject("databaseUrl"));
let alphaId: string;
let betaId: string;
let actorId: string;

beforeAll(async () => {
  alphaId = await openTestSchool(db, "audit-alpha");
  betaId = await openTestSchool(db, "audit-beta");
  actorId = (await db.user.create({ data: { email: "audit-actor@example.com", name: "Dara" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("audit store", () => {
  it("lists a school's entries newest first, with who did each", async () => {
    const store = createAuditStore(db, alphaId);
    await store.append({ actorId, action: "course.create", targetId: "course-1", requestId: "req-1" });
    await store.append({ actorId, action: "course.delete", targetId: "course-1", requestId: "req-2" });

    const { entries, total } = await store.list({ limit: 10, offset: 0 });

    expect(total).toBe(2);
    expect(entries.map(({ action, requestId }) => ({ action, requestId }))).toEqual([
      { action: "course.delete", requestId: "req-2" },
      { action: "course.create", requestId: "req-1" },
    ]);
    expect(entries[0]?.actor).toEqual({ id: actorId, email: "audit-actor@example.com", name: "Dara" });
  });

  it("pages through the entries", async () => {
    const { entries, total } = await createAuditStore(db, alphaId).list({ limit: 1, offset: 1 });

    expect(total).toBe(2);
    expect(entries.map((entry) => entry.action)).toEqual(["course.create"]);
  });

  it("never shows another school's entries", async () => {
    expect(await createAuditStore(db, betaId).list({ limit: 10, offset: 0 })).toEqual({ entries: [], total: 0 });
  });

  it("keeps an entry when its actor's account is deleted", async () => {
    const leaver = (await db.user.create({ data: { email: "audit-leaver@example.com" } })).id;
    const store = createAuditStore(db, betaId);
    await store.append({ actorId: leaver, action: "school.settings.update", targetId: betaId, requestId: "req-3" });

    await db.user.delete({ where: { id: leaver } });

    expect((await store.list({ limit: 10, offset: 0 })).entries).toEqual([
      expect.objectContaining({ action: "school.settings.update", actor: null }),
    ]);
  });
});
