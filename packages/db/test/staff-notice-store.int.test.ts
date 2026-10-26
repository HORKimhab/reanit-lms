import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createCatalogStore, createCommentStore, createDbClient, createNotificationPreferenceStore, createStaffNoticeStore } from "../src";
import { openTestSchool } from "../src/test/schools";

const db = createDbClient(inject("databaseUrl"));
const LESSON = randomUUID();
const STAFF_ROLES = ["owner", "admin", "instructor"] as const;
let schoolId: string;
let otherSchoolId: string;
let ownerId: string;
let instructorId: string;
let studentId: string;
let courseId: string;

beforeAll(async () => {
  schoolId = await openTestSchool(db, "notices-alpha");
  otherSchoolId = await openTestSchool(db, "notices-beta");
  ownerId = (await db.membership.findFirstOrThrow({ where: { schoolId, role: "owner" }, select: { userId: true } })).userId;
  instructorId = (await db.user.create({ data: { email: "notices-teacher@example.com", name: "Vanna" } })).id;
  await db.membership.create({ data: { schoolId, userId: instructorId, role: "instructor" } });
  studentId = (await db.user.create({ data: { email: "notices-student@example.com", name: "Sokha" } })).id;
  await db.membership.create({ data: { schoolId, userId: studentId, role: "student" } });
  const catalog = createCatalogStore(db, schoolId);
  courseId = (await catalog.createCourse({ title: "Brand", slug: "brand" })).id;
  const lesson = { type: "text" as const, durationSeconds: 0, unlockAfterDays: null, unlockAt: null };
  await catalog.replaceOutline(courseId, { sections: [{ id: randomUUID(), title: "One", lessons: [{ ...lesson, id: LESSON, title: "Exports" }] }] });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("staff notice store", () => {
  it("lists the staff with the given roles, giving them default settings and an unsubscribe token", async () => {
    const recipients = await createStaffNoticeStore(db, schoolId).findRecipients("newComment", STAFF_ROLES);

    expect(recipients).toEqual([
      { email: "notices-alpha@example.com", name: null, locale: "en", unsubscribeToken: expect.any(String) },
      { email: "notices-teacher@example.com", name: "Vanna", locale: "en", unsubscribeToken: expect.any(String) },
    ]);
    expect(await db.notificationPreference.count({ where: { schoolId } })).toBe(2);
  });

  it("keeps a staff member's token and leaves out those who turned the kind off", async () => {
    const store = createStaffNoticeStore(db, schoolId);
    const [first] = await store.findRecipients("newSale", ["owner"]);
    await createNotificationPreferenceStore(db).savePreferences(schoolId, instructorId, { newSale: true, newComment: false, courseCompleted: true, locale: "km" });

    expect(await store.findRecipients("newSale", ["owner"])).toEqual([first]);
    expect((await store.findRecipients("newComment", STAFF_ROLES)).map(({ email }) => email)).toEqual(["notices-alpha@example.com"]);
    expect((await store.findRecipients("courseCompleted", STAFF_ROLES)).find(({ email }) => email === "notices-teacher@example.com")?.locale).toBe("km");
  });

  it("finds no staff of another school", async () => {
    expect((await createStaffNoticeStore(db, otherSchoolId).findRecipients("newSale", STAFF_ROLES)).map(({ email }) => email)).toEqual([
      "notices-beta@example.com",
    ]);
  });

  it("describes a student's comment and marks a staff member's", async () => {
    const comments = createCommentStore(db, schoolId);
    const question = await comments.createComment({ lessonId: LESSON, authorId: studentId, parentId: null, body: "How do I export?", at: new Date() });
    const answer = await comments.createComment({ lessonId: LESSON, authorId: ownerId, parentId: question.id, body: "Use File, Export.", at: new Date() });
    const store = createStaffNoticeStore(db, schoolId);

    expect(await store.findComment(question.id)).toEqual({
      authorName: "Sokha",
      isStaffAuthor: false,
      body: "How do I export?",
      lessonTitle: "Exports",
      courseTitle: "Brand",
      schoolName: "notices-alpha",
    });
    expect((await store.findComment(answer.id))?.isStaffAuthor).toBe(true);
    expect(await createStaffNoticeStore(db, otherSchoolId).findComment(question.id)).toBeNull();
  });

  it("describes a completed enrollment, and nothing for one not completed", async () => {
    const enrollment = await db.enrollment.create({ data: { schoolId, userId: studentId, courseId, source: "manual" } });
    const store = createStaffNoticeStore(db, schoolId);
    expect(await store.findCompletion(enrollment.id)).toBeNull();

    await db.enrollment.update({ where: { id: enrollment.id }, data: { completedAt: new Date() } });

    expect(await store.findCompletion(enrollment.id)).toEqual({
      studentName: "Sokha",
      studentEmail: "notices-student@example.com",
      courseTitle: "Brand",
      schoolName: "notices-alpha",
    });
    expect(await createStaffNoticeStore(db, otherSchoolId).findCompletion(enrollment.id)).toBeNull();
  });
});
