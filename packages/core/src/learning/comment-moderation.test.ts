import { beforeEach, describe, expect, it } from "vitest";

import { FakeClock } from "../test/auth-fakes";
import { FakeCommentStore } from "../test/learning-fakes";
import { createCommentModeration, type CommentModeration } from "./comment-moderation";
import { COMMENT_INBOX_PAGE_SIZE } from "./comments";
import { CommentNotFoundError } from "./errors";

const NOW = new Date("2026-10-20T00:00:00Z");
const STAFF = "staff-1";

let store: FakeCommentStore;
let moderation: CommentModeration;

beforeEach(() => {
  store = new FakeCommentStore();
  store.staffIds.add(STAFF);
  moderation = createCommentModeration({ store, clock: new FakeClock(NOW) });
});

/**
 * Posts a student's question under a lesson.
 *
 * @param body The question.
 * @returns The comment.
 */
function ask(body: string) {
  return store.createComment({ lessonId: "l1", authorId: "student-1", parentId: null, body, at: NOW });
}

describe("createCommentModeration", () => {
  it("lists unanswered threads until staff reply, and every thread on request", async () => {
    const question = await ask("Where is the workbook?");
    await ask("Is there a certificate?");

    await moderation.reply(STAFF, question.id, "Under the first lesson");

    expect((await moderation.listInbox({ page: 1, filter: "unanswered" })).threads.map(({ body }) => body)).toEqual(["Is there a certificate?"]);
    expect(await moderation.listInbox({ page: 1, filter: "all" })).toMatchObject({ total: 2, page: 1, pageSize: COMMENT_INBOX_PAGE_SIZE });
  });

  it("puts a reply to a reply into the thread, as staff, now", async () => {
    const question = await ask("Question");
    const followUp = await store.createComment({ lessonId: "l1", authorId: "student-1", parentId: question.id, body: "Follow-up", at: NOW });

    const reply = await moderation.reply(STAFF, followUp.id, "Answer");

    expect(reply).toMatchObject({ body: "Answer", author: { id: STAFF, isStaff: true }, createdAt: NOW });
    expect(store.comments.at(-1)?.parentId).toBe(question.id);
  });

  it("hides a comment from students but keeps it for staff", async () => {
    const question = await ask("Spam");

    await moderation.setHidden(question.id, true);

    expect(await store.listThreads("l1", { includeHidden: false })).toEqual([]);
    expect((await moderation.listLessonComments("l1"))[0]).toMatchObject({ body: "Spam", isHidden: true });
  });

  it("throws CommentNotFoundError for a comment the school does not have", async () => {
    await expect(moderation.setHidden("missing", true)).rejects.toThrow(CommentNotFoundError);
    await expect(moderation.reply(STAFF, "missing", "Hi")).rejects.toThrow(CommentNotFoundError);
  });
});
