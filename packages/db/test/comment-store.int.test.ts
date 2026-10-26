import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createCatalogStore, createCommentStore, createDbClient } from "../src";
import { openTestSchool } from "../src/test/schools";

const db = createDbClient(inject("databaseUrl"));
const LESSON = randomUUID();
const OTHER_LESSON = randomUUID();
const AT = new Date("2026-10-20T01:00:00Z");
let alphaId: string;
let betaId: string;
let ownerId: string;
let studentId: string;

/**
 * Posts a student's comment under the test lesson, a little later each time.
 *
 * @param body The text.
 * @param minutes Minutes after `AT` it is written.
 * @param parentId The thread it replies to.
 * @returns The comment.
 */
function studentSays(body: string, minutes: number, parentId: string | null = null) {
  return createCommentStore(db, alphaId).createComment({ lessonId: LESSON, authorId: studentId, parentId, body, at: new Date(AT.getTime() + minutes * 60_000) });
}

beforeAll(async () => {
  alphaId = await openTestSchool(db, "comments-alpha");
  betaId = await openTestSchool(db, "comments-beta");
  ownerId = (await db.membership.findFirstOrThrow({ where: { schoolId: alphaId, role: "owner" }, select: { userId: true } })).userId;
  const catalog = createCatalogStore(db, alphaId);
  const courseId = (await catalog.createCourse({ title: "Talked", slug: "talked" })).id;
  const lesson = { type: "text" as const, durationSeconds: 0, unlockAfterDays: null, unlockAt: null };
  await catalog.replaceOutline(courseId, {
    sections: [{ id: randomUUID(), title: "One", lessons: [{ ...lesson, id: LESSON, title: "Talk" }, { ...lesson, id: OTHER_LESSON, title: "Quiet" }] }],
  });
  studentId = (await db.user.create({ data: { email: "comments-student@example.com", name: "Sokha" } })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("comment store", () => {
  it("lists a lesson's threads newest first with replies oldest first, marking staff authors", async () => {
    const store = createCommentStore(db, alphaId);
    const first = await studentSays("First question", 0);
    await studentSays("Second question", 1);
    await store.createComment({ lessonId: LESSON, authorId: ownerId, parentId: first.id, body: "Owner answer", at: new Date(AT.getTime() + 2 * 60_000) });
    await studentSays("Follow-up", 3, first.id);

    const threads = await store.listThreads(LESSON, { includeHidden: false });
    const events = await db.outboxEvent.findMany({ where: { type: "CommentPosted", schoolId: alphaId }, select: { payload: true } });
    expect(events).toContainEqual({ payload: { commentId: first.id, lessonId: LESSON, authorId: studentId } });

    expect(threads.map(({ body }) => body)).toEqual(["Second question", "First question"]);
    expect(threads[1]?.replies.map(({ body, author }) => [body, author?.isStaff])).toEqual([
      ["Owner answer", true],
      ["Follow-up", false],
    ]);
    expect(threads[1]).toMatchObject({ lessonId: LESSON, author: { id: studentId, name: "Sokha", isStaff: false }, isHidden: false, createdAt: AT });
    expect(await store.listThreads(OTHER_LESSON, { includeHidden: false })).toEqual([]);
  });

  it("hides comments from students only, and lists unanswered threads for staff", async () => {
    const store = createCommentStore(db, alphaId);
    const spam = await studentSays("Spam", 10);
    const answered = (await store.listThreads(LESSON, { includeHidden: false })).find(({ body }) => body === "First question");

    expect(await store.setHidden(spam.id, true)).toBe(true);

    expect((await store.listThreads(LESSON, { includeHidden: false })).map(({ body }) => body)).not.toContain("Spam");
    expect((await store.listThreads(LESSON, { includeHidden: true }))[0]).toMatchObject({ body: "Spam", isHidden: true });
    const unanswered = await store.listInbox({ isUnansweredOnly: true, limit: 10, offset: 0 });
    expect(unanswered.threads.map(({ body }) => body)).toEqual(["Spam", "Second question"]);
    expect(unanswered.threads.map(({ id }) => id)).not.toContain(answered?.id);
    expect(unanswered.threads[0]).toMatchObject({ lesson: { id: LESSON, title: "Talk" }, course: { slug: "talked", title: "Talked" }, isAnswered: false });
    expect(await store.listInbox({ isUnansweredOnly: false, limit: 1, offset: 1 })).toMatchObject({ total: 3, threads: [{ body: "Second question" }] });
  });

  it("finds a comment's place and deletes it with its replies", async () => {
    const store = createCommentStore(db, alphaId);
    const thread = await studentSays("Delete me", 20);
    const reply = await studentSays("Reply", 21, thread.id);

    expect(await store.findComment(reply.id)).toEqual({ id: reply.id, lessonId: LESSON, authorId: studentId, parentId: thread.id });
    await store.deleteComment(thread.id);

    expect(await store.findComment(reply.id)).toBeNull();
  });

  it("shows and lets another school change nothing", async () => {
    const beta = createCommentStore(db, betaId);
    const comment = await studentSays("Private", 30);

    expect(await beta.findComment(comment.id)).toBeNull();
    expect(await beta.setHidden(comment.id, true)).toBe(false);
    expect(await beta.listInbox({ isUnansweredOnly: false, limit: 10, offset: 0 })).toEqual({ threads: [], total: 0 });
    await beta.deleteComment(comment.id);
    expect(await createCommentStore(db, alphaId).findComment(comment.id)).not.toBeNull();
  });
});
