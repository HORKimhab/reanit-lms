import { CommentNotFoundError } from "@reanit/core/learning";
import { describe, expect, it } from "vitest";

import { TEST_SCHOOL, TEST_USER, useStaffApp } from "../test/session";

const COMMENT_ID = "3c2b1a09-8f7e-4d6c-9b5a-4e3d2c1b0a61";
const LESSON_ID = "3c2b1a09-8f7e-4d6c-9b5a-4e3d2c1b0a60";
const AT = new Date("2026-10-20T01:00:00Z");
const COMMENT = { id: COMMENT_ID, body: "Where is the workbook?", author: { id: TEST_USER.id, name: "Dara", isStaff: false }, isHidden: false, createdAt: AT };
const THREAD = { ...COMMENT, lessonId: LESSON_ID, replies: [] };
const staff = useStaffApp();

describe("comment moderation routes", () => {
  it("lists the inbox page with ISO times, unanswered by default", async () => {
    const inboxThread = { ...THREAD, lesson: { id: LESSON_ID, title: "Welcome" }, course: { slug: "brand", title: "Brand" }, isAnswered: false };
    staff.clients.moderation.listInbox.mockResolvedValue({ threads: [inboxThread], total: 1, page: 1, pageSize: 20 });

    const response = await staff.app.inject({ method: "GET", url: "/comments", headers: staff.headers });

    expect(response.json()).toEqual({ threads: [{ ...inboxThread, createdAt: AT.toISOString() }], total: 1, page: 1, pageSize: 20 });
    expect(staff.clients.moderationFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
    expect(staff.clients.moderation.listInbox).toHaveBeenCalledWith({ page: 1, filter: "unanswered" });
  });

  it("lists a lesson's threads for staff", async () => {
    staff.clients.moderation.listLessonComments.mockResolvedValue([THREAD]);

    const response = await staff.app.inject({ method: "GET", url: `/lessons/${LESSON_ID}/comments`, headers: staff.headers });

    expect(response.json()).toEqual({ threads: [{ ...THREAD, createdAt: AT.toISOString() }] });
  });

  it("replies as the signed-in staff member", async () => {
    staff.clients.moderation.reply.mockResolvedValue({ ...COMMENT, body: "Under lesson one" });

    const response = await staff.app.inject({ method: "POST", url: `/comments/${COMMENT_ID}/replies`, headers: staff.headers, payload: { body: " Under lesson one " } });

    expect(response.statusCode).toBe(201);
    expect(staff.clients.moderation.reply).toHaveBeenCalledWith(TEST_USER.id, COMMENT_ID, "Under lesson one");
  });

  it("hides a comment and answers 404 for one the school does not have", async () => {
    staff.clients.moderation.setHidden.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new CommentNotFoundError());

    const hidden = await staff.app.inject({ method: "PATCH", url: `/comments/${COMMENT_ID}`, headers: staff.headers, payload: { isHidden: true } });
    const missing = await staff.app.inject({ method: "PATCH", url: `/comments/${COMMENT_ID}`, headers: staff.headers, payload: { isHidden: true } });

    expect(hidden.statusCode).toBe(204);
    expect(staff.clients.moderation.setHidden).toHaveBeenCalledWith(COMMENT_ID, true);
    expect(missing.json()).toMatchObject({ status: 404, type: "urn:reanit:problem:comment-not-found" });
  });
});
