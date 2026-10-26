import type { DbClient } from "./client";
import { STAFF_ROLES } from "./comment-store";
import { appendEvent } from "./outbox";

/** Domain no email is ever delivered to (RFC 2606), for the address an erased account keeps. */
const ERASED_EMAIL_DOMAIN = "erased.invalid";

/** Each row's school, by name. */
const SCHOOL_NAME = { school: { select: { name: true } } } as const;

/**
 * Builds the address an erased account keeps: unique, so the person's own address is free to sign up again.
 *
 * @param userId The erased account.
 * @returns An address that names no one and receives nothing.
 */
function erasedEmail(userId: string) {
  return `${userId}@${ERASED_EMAIL_DOMAIN}`;
}

/**
 * A person's own data across every school they bought from, learned in or helped run, for their GDPR
 * export and erasure. A data subject's rows span tenants, so this store uses the unscoped client, and
 * every query is limited to the person's own rows by their user id. It satisfies `AccountStore` from `@reanit/core/auth`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @returns The store operations.
 * @example
 * const account = createAccountService({ store: createAccountStore(db), clock });
 */
export function createAccountStore(db: DbClient) {
  return {
    /**
     * Collects everything stored about a person.
     *
     * @param userId The person.
     * @returns Their account, memberships, enrollments with progress, orders, quiz attempts, comments and certificates; null when the account does not exist.
     */
    async exportUserData(userId: string) {
      const account = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, createdAt: true } });
      if (!account) return null;
      const byUser = { where: { userId }, orderBy: { createdAt: "asc" } } as const;
      const [memberships, enrollments, orders, comments] = await Promise.all([
        db.membership.findMany({ ...byUser, select: { role: true, createdAt: true, ...SCHOOL_NAME } }),
        db.enrollment.findMany({
          ...byUser,
          select: {
            source: true,
            createdAt: true,
            completedAt: true,
            course: { select: { title: true } },
            ...SCHOOL_NAME,
            progress: { select: { videoPositionSeconds: true, completedAt: true, lesson: { select: { title: true } } } },
            quizAttempts: { orderBy: { createdAt: "asc" }, select: { scorePercent: true, isPassed: true, answers: true, createdAt: true, lesson: { select: { title: true } } } },
            certificate: { select: { id: true, studentName: true, courseTitle: true, issuedAt: true } },
          },
        }),
        db.order.findMany({
          ...byUser,
          select: {
            status: true,
            paymentMethod: true,
            totalAmount: true,
            currency: true,
            createdAt: true,
            paidAt: true,
            ...SCHOOL_NAME,
            items: { select: { amount: true, currency: true, course: { select: { title: true } } } },
          },
        }),
        db.lessonComment.findMany({
          where: { authorId: userId },
          orderBy: { createdAt: "asc" },
          select: { body: true, createdAt: true, lesson: { select: { title: true } }, ...SCHOOL_NAME },
        }),
      ]);

      return {
        account,
        memberships: memberships.map(({ role, createdAt, school }) => ({ school: school.name, role, joinedAt: createdAt })),
        enrollments: enrollments.map(({ source, createdAt, completedAt, course, school, progress }) => ({
          school: school.name,
          course: course.title,
          source,
          enrolledAt: createdAt,
          completedAt,
          lessons: progress.map(({ lesson, videoPositionSeconds, completedAt: lessonCompletedAt }) => ({
            lesson: lesson.title,
            videoPositionSeconds,
            completedAt: lessonCompletedAt,
          })),
        })),
        orders: orders.map(({ status, paymentMethod, totalAmount, currency, createdAt, paidAt, school, items }) => ({
          school: school.name,
          status,
          paymentMethod,
          total: { amount: totalAmount, currency },
          items: items.map((item) => ({ course: item.course.title, amount: item.amount, currency: item.currency })),
          createdAt,
          paidAt,
        })),
        quizAttempts: enrollments.flatMap(({ school, quizAttempts }) =>
          quizAttempts.map(({ lesson, ...attempt }) => ({ school: school.name, lesson: lesson.title, ...attempt })),
        ),
        comments: comments.map(({ body, createdAt, lesson, school }) => ({ school: school.name, lesson: lesson.title, body, createdAt })),
        certificates: enrollments.flatMap(({ school, certificate }) => (certificate ? [{ ...certificate, school: school.name }] : [])),
      };
    },

    /**
     * Tells whether a person helps run any school.
     *
     * @param userId The person.
     * @returns True for an owner, admin or instructor anywhere.
     */
    async isSchoolStaff(userId: string) {
      return (await db.membership.count({ where: { userId, role: { in: STAFF_ROLES } } })) > 0;
    },

    /**
     * Erases a person in one transaction: their enrollments (with progress, quiz attempts and
     * certificates), memberships, email settings, sessions and sign-in links go; their comments stay
     * under no name; their pending orders fail; and the account keeps only its id, so paid orders stay
     * whole. Each school whose certificate PDFs named them gets `StudentErased`, so the worker deletes the files.
     *
     * @param userId The person.
     * @throws {Error} When the account does not exist.
     */
    async eraseUser(userId: string) {
      await db.$transaction(async (tx) => {
        const { email } = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
        const certificates = await tx.certificate.findMany({ where: { enrollment: { userId }, pdfKey: { not: null } }, select: { schoolId: true, pdfKey: true } });

        await tx.enrollment.deleteMany({ where: { userId } });
        await tx.lessonComment.updateMany({ where: { authorId: userId }, data: { authorId: null } });
        await tx.order.updateMany({ where: { userId, status: "pending" }, data: { status: "failed" } });
        await tx.notificationPreference.deleteMany({ where: { userId } });
        await tx.membership.deleteMany({ where: { userId } });
        await tx.session.deleteMany({ where: { userId } });
        await tx.magicLinkToken.deleteMany({ where: { email } });
        await tx.user.update({ where: { id: userId }, data: { email: erasedEmail(userId), name: null, passwordHash: null } });

        const fileKeysBySchool = new Map<string, string[]>();
        for (const { schoolId, pdfKey } of certificates) {
          // The query kept only certificates with a PDF.
          fileKeysBySchool.set(schoolId, [...(fileKeysBySchool.get(schoolId) ?? []), pdfKey!]);
        }
        for (const [schoolId, fileKeys] of fileKeysBySchool) await appendEvent(tx, { type: "StudentErased", schoolId, payload: { fileKeys } });
      });
    },
  };
}
