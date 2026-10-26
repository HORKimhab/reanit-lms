import { beforeEach, describe, expect, it } from "vitest";

import type { CommentPosted, CourseCompleted, OrderPaid } from "../events";
import { FakeMailer } from "../test/auth-fakes";
import { FakeReceiptStore, FakeStaffComposer, FakeStaffNoticeStore, TEST_RECEIPT } from "../test/notification-fakes";
import { ReceiptNotFoundError } from "./errors";
import { createStaffNotifications, type StaffNotifications } from "./staff";

const APP_URL = "https://reanit.com";
const TOKEN = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a01";
const RECEIPT = { ...TEST_RECEIPT, locale: "en" } as const;
const ORDER_PAID: OrderPaid = { type: "OrderPaid", schoolId: "school-1", payload: { orderId: "order-1", userId: "buyer-1", courseIds: ["c-1", "c-2"] } };
const COMMENT_POSTED: CommentPosted = { type: "CommentPosted", schoolId: "school-1", payload: { commentId: "comment-1", lessonId: "lesson-1", authorId: "student-1" } };
const COURSE_COMPLETED: CourseCompleted = { type: "CourseCompleted", schoolId: "school-1", payload: { enrollmentId: "enrollment-1", courseId: "c-1" } };

let notices: FakeStaffNoticeStore;
let receipts: FakeReceiptStore;
let mailer: FakeMailer;
let askedSchools: string[];
let staff: StaffNotifications;

beforeEach(() => {
  notices = new FakeStaffNoticeStore();
  notices.staff.push(
    { email: "owner@angkor.com", name: "Dara", locale: "km", unsubscribeToken: TOKEN, role: "owner", turnedOff: [] },
    { email: "teacher@angkor.com", name: null, locale: "en", unsubscribeToken: "token-2", role: "instructor", turnedOff: [] },
  );
  receipts = new FakeReceiptStore();
  receipts.receipts.set("order-1", RECEIPT);
  mailer = new FakeMailer();
  askedSchools = [];
  staff = createStaffNotifications({ noticesFor, receiptsFor, mailer, composer: new FakeStaffComposer(), appUrl: APP_URL });
});

/**
 * Hands out the test's staff notice store, recording which school asked.
 *
 * @param schoolId The event's school.
 * @returns The fake store.
 */
function noticesFor(schoolId: string) {
  askedSchools.push(schoolId);
  return notices;
}

/**
 * Hands out the test's receipt store.
 *
 * @returns The fake store.
 */
function receiptsFor() {
  return receipts;
}

describe("notifySale", () => {
  it("emails the owner the sale, in their language, with unsubscribe and settings links", async () => {
    await staff.notifySale(ORDER_PAID);

    const unsubscribeUrl = `${APP_URL}/km/unsubscribe?token=${TOKEN}&kind=newSale`;
    expect(mailer.sent).toEqual([
      {
        to: "owner@angkor.com",
        unsubscribeUrl,
        subject: "Sale to sokha@example.com: Brand, Social for 7400 USD",
        text: `${APP_URL}/km/dashboard/analytics | km | Angkor Academy | ${unsubscribeUrl} | ${APP_URL}/km/dashboard/settings#notifications`,
      },
    ]);
    expect(askedSchools).toEqual(["school-1"]);
  });

  it("skips staff who turned sale emails off", async () => {
    notices.staff[0]!.turnedOff.push("newSale"); // the owner was pushed in beforeEach

    await staff.notifySale(ORDER_PAID);

    expect(mailer.sent).toEqual([]);
  });

  it("throws ReceiptNotFoundError when the school has no such paid order", async () => {
    receipts.receipts.clear();

    await expect(staff.notifySale(ORDER_PAID)).rejects.toThrow(ReceiptNotFoundError);
  });
});

describe("notifyComment", () => {
  const COMMENT = { authorName: "Sokha", isStaffAuthor: false, body: "How do I export?", lessonTitle: "Exports", courseTitle: "Brand", schoolName: "Angkor Academy" };

  it("emails every staff member about a student's comment, with a link to the inbox", async () => {
    notices.comments.set("comment-1", COMMENT);

    await staff.notifyComment(COMMENT_POSTED);

    expect(mailer.sent.map((mail) => [mail.to, mail.subject])).toEqual([
      ["owner@angkor.com", "Comment by Sokha on Exports (Brand): How do I export?"],
      ["teacher@angkor.com", "Comment by Sokha on Exports (Brand): How do I export?"],
    ]);
    expect(mailer.sent[1]?.text).toMatch(new RegExp(`^${APP_URL}/dashboard/comments \\| en \\| Angkor Academy \\| ${APP_URL}/unsubscribe\\?token=token-2&kind=newComment`));
  });

  it("sends nothing for a staff member's comment", async () => {
    notices.comments.set("comment-1", { ...COMMENT, isStaffAuthor: true });

    await staff.notifyComment(COMMENT_POSTED);

    expect(mailer.sent).toEqual([]);
  });

  it("sends nothing for a comment deleted before the email went out", async () => {
    await staff.notifyComment(COMMENT_POSTED);

    expect(mailer.sent).toEqual([]);
  });
});

describe("notifyCompletion", () => {
  it("emails every staff member that a student completed a course, with a link to the students list", async () => {
    notices.completions.set("enrollment-1", { studentName: "Sokha", studentEmail: "sokha@example.com", courseTitle: "Brand", schoolName: "Angkor Academy" });

    await staff.notifyCompletion(COURSE_COMPLETED);

    expect(mailer.sent.map((mail) => mail.subject)).toEqual(["sokha@example.com completed Brand", "sokha@example.com completed Brand"]);
    expect(mailer.sent[0]?.text).toMatch(new RegExp(`^${APP_URL}/km/dashboard/students `));
  });

  it("sends nothing for an enrollment removed before the email went out", async () => {
    await staff.notifyCompletion(COURSE_COMPLETED);

    expect(mailer.sent).toEqual([]);
  });
});
