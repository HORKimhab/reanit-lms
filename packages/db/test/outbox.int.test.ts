import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createDbClient, createOutboxStore, inSchoolTransaction } from "../src";
import { appendEvent } from "../src/outbox";
import { openTestSchool } from "../src/test/schools";

const db = createDbClient(inject("databaseUrl"));
const outbox = createOutboxStore(db);
const BATCH = 1000;
let schoolId: string;

/**
 * Writes `CourseCompleted` events for this file's school, one per course id, a millisecond apart.
 *
 * @param courseIds Ids to put in the payloads, in the order they happen.
 * @returns The new events' ids, in order.
 */
async function writeEvents(...courseIds: string[]) {
  for (const courseId of courseIds) {
    await inSchoolTransaction(db, schoolId, (tx) => appendEvent(tx, { type: "CourseCompleted", schoolId, payload: { enrollmentId: "e", courseId } }));
  }
  const rows = await db.outboxEvent.findMany({ where: { schoolId, publishedAt: null }, orderBy: { occurredAt: "asc" }, select: { id: true } });
  return rows.map((row) => row.id);
}

/**
 * Lists this file's school's events that are still unpublished.
 *
 * @returns Their ids.
 */
async function pendingIds() {
  return (await db.outboxEvent.findMany({ where: { schoolId, publishedAt: null }, select: { id: true } })).map((row) => row.id);
}

beforeAll(async () => {
  schoolId = await openTestSchool(db, "outbox-school");
});

afterAll(async () => {
  await db.$disconnect();
});

// Other test files write events to the same database, so assertions only look at this school's.
describe("outbox store", () => {
  it("hands pending events over oldest first, then marks them published", async () => {
    const ids = await writeEvents("first", "second");
    const published: unknown[] = [];

    await outbox.publishPending(BATCH, async (events) => {
      published.push(...events.filter((event) => event.schoolId === schoolId));
    });

    expect(published).toEqual([
      { id: ids[0], type: "CourseCompleted", schoolId, payload: { enrollmentId: "e", courseId: "first" }, occurredAt: expect.any(Date) },
      { id: ids[1], type: "CourseCompleted", schoolId, payload: { enrollmentId: "e", courseId: "second" }, occurredAt: expect.any(Date) },
    ]);
    expect(await pendingIds()).toEqual([]);
  });

  it("keeps events pending when publishing fails", async () => {
    const ids = await writeEvents("failing");

    await expect(
      outbox.publishPending(BATCH, async () => {
        throw new Error("queue down");
      }),
    ).rejects.toThrow("queue down");

    expect(await pendingIds()).toEqual(ids);
    await outbox.publishPending(BATCH, async () => undefined);
  });

  it("never hands the same event to two concurrent relays", async () => {
    await writeEvents("a", "b", "c");
    const seen: string[] = [];

    /**
     * Records this school's events, holding the claim a moment so the relays overlap.
     *
     * @param events The claimed events.
     */
    async function collect(events: { id: string; schoolId: string }[]) {
      seen.push(...events.filter((event) => event.schoolId === schoolId).map((event) => event.id));
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await Promise.all([outbox.publishPending(1, collect), outbox.publishPending(1, collect), outbox.publishPending(BATCH, collect)]);

    expect(new Set(seen).size).toBe(seen.length);
    expect(await pendingIds()).toEqual([]);
  });

});
