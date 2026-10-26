import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createAccountStore, createCatalogStore, createCommerceStore, createDbClient } from "../src";
import { enrollTestStudent, openTestSchool } from "../src/test/schools";
import { ONE_TIME } from "../src/test/payments";

const db = createDbClient(inject("databaseUrl"));
const store = createAccountStore(db);
const AT = new Date("2026-10-26T01:00:00Z");

/**
 * Opens a school with one course of one lesson.
 *
 * @param subdomain Unique subdomain.
 * @returns The school's, course's and lesson's ids.
 */
async function openSchoolWithCourse(subdomain: string) {
  const schoolId = await openTestSchool(db, subdomain);
  const catalog = createCatalogStore(db, schoolId);
  const courseId = (await catalog.createCourse({ title: `${subdomain} course`, slug: "course" })).id;
  const lessonId = randomUUID();
  const lesson = { type: "text" as const, durationSeconds: 0, unlockAfterDays: null, unlockAt: null };
  await catalog.replaceOutline(courseId, { sections: [{ id: randomUUID(), title: "One", lessons: [{ ...lesson, id: lessonId, title: "Lesson one" }] }] });
  return { schoolId, courseId, lessonId };
}

/**
 * Creates an order for a course, at a new price.
 *
 * @param school The school and course.
 * @param school.schoolId The school.
 * @param school.courseId The course.
 * @param userId The buyer.
 * @returns The order's id.
 */
async function orderCourse({ schoolId, courseId }: { schoolId: string; courseId: string }, userId: string) {
  const commerce = createCommerceStore(db, schoolId);
  const price = await commerce.setPrice(courseId, { amount: 4900, currency: "USD", billing: ONE_TIME });
  // setPrice found the course the test created.
  return (await commerce.createOrder({ userId, price: price!, lines: [{ courseId, amount: price!.amount }], bundleId: null, couponId: null, method: "stripe", locale: "en", subscriptionId: null })).id;
}

let alpha: Awaited<ReturnType<typeof openSchoolWithCourse>>;
let beta: Awaited<ReturnType<typeof openSchoolWithCourse>>;
let studentId: string;
let otherStudentId: string;
let ownerId: string;
let paidOrderId: string;
let pendingOrderId: string;
let awaitingOrderId: string;
let subscriptionId: string;

beforeAll(async () => {
  alpha = await openSchoolWithCourse("account-alpha");
  beta = await openSchoolWithCourse("account-beta");
  ownerId = (await db.membership.findFirstOrThrow({ where: { schoolId: alpha.schoolId, role: "owner" }, select: { userId: true } })).userId;
  const { studentId: id, enrollmentId } = await enrollTestStudent(db, alpha, "account-student@example.com");
  studentId = id;
  await db.user.update({ where: { id }, data: { name: "Sokha" } });
  await db.membership.create({ data: { schoolId: alpha.schoolId, userId: id, role: "student" } });
  await db.lessonProgress.create({ data: { schoolId: alpha.schoolId, enrollmentId, lessonId: alpha.lessonId, videoPositionSeconds: 42, completedAt: AT } });
  await db.quizAttempt.create({ data: { schoolId: alpha.schoolId, enrollmentId, lessonId: alpha.lessonId, answers: { q1: "a" }, scorePercent: 80, isPassed: true, createdAt: AT } });
  await db.certificate.create({ data: { schoolId: alpha.schoolId, enrollmentId, studentName: "Sokha", courseTitle: "account-alpha course", issuedAt: AT, pdfKey: "schools/alpha/certificates/c1.pdf" } });
  await db.enrollment.create({ data: { schoolId: beta.schoolId, userId: id, courseId: beta.courseId, source: "manual" } });
  const question = await db.lessonComment.create({ data: { schoolId: alpha.schoolId, lessonId: alpha.lessonId, authorId: id, body: "How do I start?", createdAt: AT } });
  await db.lessonComment.create({ data: { schoolId: alpha.schoolId, lessonId: alpha.lessonId, authorId: ownerId, parentId: question.id, body: "Open lesson one.", createdAt: AT } });
  paidOrderId = await orderCourse(alpha, id);
  await db.order.update({ where: { id: paidOrderId }, data: { status: "paid", paidAt: AT } });
  pendingOrderId = await orderCourse(beta, id);
  awaitingOrderId = await orderCourse(beta, id);
  await db.order.update({ where: { id: awaitingOrderId }, data: { status: "awaiting_confirmation", paymentMethod: "offline_qr", paymentReference: "ABA-1" } });
  const { priceId } = await db.orderItem.findFirstOrThrow({ where: { orderId: awaitingOrderId }, select: { priceId: true } });
  subscriptionId = (await db.subscription.create({ data: { schoolId: beta.schoolId, userId: id, priceId, status: "active", paidPeriods: 1 } })).id;
  await db.session.create({ data: { userId: id, tokenHash: "account-session", expiresAt: new Date("2027-01-01T00:00:00Z") } });
  await db.magicLinkToken.create({ data: { email: "account-student@example.com", tokenHash: "account-link", expiresAt: new Date("2027-01-01T00:00:00Z") } });
  otherStudentId = (await enrollTestStudent(db, alpha, "account-other@example.com")).studentId;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("account store", () => {
  it("exports everything stored about a person across schools", async () => {
    const data = await store.exportUserData(studentId);

    expect(data?.account).toMatchObject({ id: studentId, email: "account-student@example.com", name: "Sokha" });
    expect(data?.memberships).toEqual([{ school: "account-alpha", role: "student", joinedAt: expect.any(Date) }]);
    expect(data?.enrollments.map(({ school, course, lessons }) => [school, course, lessons])).toEqual([
      ["account-alpha", "account-alpha course", [{ lesson: "Lesson one", videoPositionSeconds: 42, completedAt: AT }]],
      ["account-beta", "account-beta course", []],
    ]);
    expect(data?.orders.map(({ school, status, total, items }) => [school, status, total, items])).toEqual([
      ["account-alpha", "paid", { amount: 4900, currency: "USD" }, [{ course: "account-alpha course", amount: 4900, currency: "USD" }]],
      ["account-beta", "pending", { amount: 4900, currency: "USD" }, [{ course: "account-beta course", amount: 4900, currency: "USD" }]],
      ["account-beta", "awaiting_confirmation", { amount: 4900, currency: "USD" }, [{ course: "account-beta course", amount: 4900, currency: "USD" }]],
    ]);
    expect(data?.quizAttempts).toEqual([{ school: "account-alpha", lesson: "Lesson one", scorePercent: 80, isPassed: true, answers: { q1: "a" }, createdAt: AT }]);
    expect(data?.comments).toEqual([{ school: "account-alpha", lesson: "Lesson one", body: "How do I start?", createdAt: AT }]);
    expect(data?.certificates).toEqual([{ id: expect.any(String), school: "account-alpha", studentName: "Sokha", courseTitle: "account-alpha course", issuedAt: AT }]);
  });

  it("returns null for an account that does not exist", async () => {
    expect(await store.exportUserData(randomUUID())).toBeNull();
  });

  it("tells staff, instructors included, from students", async () => {
    const instructorId = (await db.user.create({ data: { email: "account-teacher@example.com" } })).id;
    await db.membership.create({ data: { schoolId: beta.schoolId, userId: instructorId, role: "instructor" } });

    expect(await store.isSchoolStaff(ownerId)).toBe(true);
    expect(await store.isSchoolStaff(instructorId)).toBe(true);
    expect(await store.isSchoolStaff(studentId)).toBe(false);
  });

  it("erases a person, keeping paid orders and comments under no name, and leaves everyone else alone", async () => {
    await store.eraseUser(studentId);

    expect(await db.user.findUniqueOrThrow({ where: { id: studentId } })).toMatchObject({ email: `${studentId}@erased.invalid`, name: null, passwordHash: null });
    expect(await db.enrollment.count({ where: { userId: studentId } })).toBe(0);
    expect(await db.lessonProgress.count({ where: { lessonId: alpha.lessonId } })).toBe(0);
    expect(await db.quizAttempt.count({ where: { lessonId: alpha.lessonId } })).toBe(0);
    expect(await db.certificate.count({ where: { schoolId: alpha.schoolId } })).toBe(0);
    expect(await db.membership.count({ where: { userId: studentId } })).toBe(0);
    expect(await db.session.count({ where: { userId: studentId } })).toBe(0);
    expect(await db.magicLinkToken.count({ where: { email: "account-student@example.com" } })).toBe(0);
    expect(await db.order.findUniqueOrThrow({ where: { id: paidOrderId } })).toMatchObject({ status: "paid", userId: studentId });
    expect((await db.order.findUniqueOrThrow({ where: { id: pendingOrderId } })).status).toBe("failed");
    expect((await db.order.findUniqueOrThrow({ where: { id: awaitingOrderId } })).status).toBe("failed");
    expect((await db.subscription.findUniqueOrThrow({ where: { id: subscriptionId } })).status).toBe("lapsed");
    expect(await db.lessonComment.findMany({ where: { lessonId: alpha.lessonId }, orderBy: { parentId: { sort: "asc", nulls: "first" } }, select: { body: true, authorId: true } })).toEqual([
      { body: "How do I start?", authorId: null },
      { body: "Open lesson one.", authorId: ownerId },
    ]);
    expect(await db.outboxEvent.findMany({ where: { type: "StudentErased" }, select: { schoolId: true, payload: true } })).toEqual([
      { schoolId: alpha.schoolId, payload: { fileKeys: ["schools/alpha/certificates/c1.pdf"] } },
    ]);
    expect(await db.enrollment.count({ where: { userId: otherStudentId } })).toBe(1);
  });
});
