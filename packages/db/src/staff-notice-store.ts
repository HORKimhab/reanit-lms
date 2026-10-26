import type { DbClient } from "./client";
import { STAFF_ROLES } from "./comment-store";
import type { MembershipRole, Prisma } from "./generated/prisma/client";
import { forSchool } from "./tenant";

/** Kinds of staff email; matches `NotificationKind` in `@reanit/core/notifications`, whose names are the settings' columns. */
type NotificationKind = "newSale" | "newComment" | "courseCompleted";
/** Languages emails are written in; matches `EmailLocale` in `@reanit/core/notifications`. */
type EmailLocale = "en" | "km";

/** The settings rows of staff who get each kind of email. */
const KIND_ON: Record<NotificationKind, Prisma.NotificationPreferenceWhereInput> = {
  newSale: { newSale: true },
  newComment: { newComment: true },
  courseCompleted: { courseCompleted: true },
};

/**
 * One school's staff and what happened in it, for the emails staff get. Every query goes through the
 * tenant client, so another school's staff, comments and enrollments are invisible; it satisfies
 * `StaffNoticeStore` from `@reanit/core/notifications`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @param schoolId The school.
 * @returns The store operations.
 * @throws {z.ZodError} When `schoolId` is not a UUID.
 * @example
 * createStaffNotifications({ noticesFor: (schoolId) => createStaffNoticeStore(db, schoolId), receiptsFor, mailer, composer, appUrl });
 */
export function createStaffNoticeStore(db: DbClient, schoolId: string) {
  const tenant = forSchool(db, schoolId);

  return {
    /**
     * Lists the staff with one of the roles who get the kind of email. Staff who never saved
     * settings get the defaults first, which also gives them their unsubscribe token.
     *
     * @param kind The kind of email.
     * @param roles The roles it goes to.
     * @returns Each recipient's address, name, language and unsubscribe token, by email.
     */
    async findRecipients(kind: NotificationKind, roles: readonly MembershipRole[]) {
      const staff = await tenant.membership.findMany({ where: { role: { in: [...roles] } }, select: { userId: true } });
      const userIds = staff.map(({ userId }) => userId);
      await tenant.notificationPreference.createMany({ data: userIds.map((userId) => ({ schoolId, userId })), skipDuplicates: true });
      const rows = await tenant.notificationPreference.findMany({
        where: { userId: { in: userIds }, ...KIND_ON[kind] },
        orderBy: { user: { email: "asc" } },
        select: { locale: true, unsubscribeToken: true, user: { select: { email: true, name: true } } },
      });
      return rows.map(({ locale, unsubscribeToken, user }) => ({ ...user, locale: locale as EmailLocale, unsubscribeToken }));
    },

    /**
     * Loads a comment with its author, lesson, course and school.
     *
     * @param commentId The comment.
     * @returns The comment, or null when the school has no such comment.
     */
    async findComment(commentId: string) {
      const comment = await tenant.lessonComment.findFirst({
        where: { id: commentId },
        select: {
          body: true,
          author: { select: { name: true, memberships: { where: { role: { in: STAFF_ROLES } }, select: { id: true }, take: 1 } } },
          lesson: { select: { title: true, section: { select: { course: { select: { title: true } } } } } },
          school: { select: { name: true } },
        },
      });
      if (!comment) return null;
      return {
        authorName: comment.author?.name ?? null,
        isStaffAuthor: (comment.author?.memberships.length ?? 0) > 0,
        body: comment.body,
        lessonTitle: comment.lesson.title,
        courseTitle: comment.lesson.section.course.title,
        schoolName: comment.school.name,
      };
    },

    /**
     * Loads a completed enrollment with its student, course and school.
     *
     * @param enrollmentId The enrollment.
     * @returns The completion, or null when the school has no such completed enrollment.
     */
    async findCompletion(enrollmentId: string) {
      const enrollment = await tenant.enrollment.findFirst({
        where: { id: enrollmentId, completedAt: { not: null } },
        select: { user: { select: { name: true, email: true } }, course: { select: { title: true } }, school: { select: { name: true } } },
      });
      if (!enrollment) return null;
      return { studentName: enrollment.user.name, studentEmail: enrollment.user.email, courseTitle: enrollment.course.title, schoolName: enrollment.school.name };
    },
  };
}
