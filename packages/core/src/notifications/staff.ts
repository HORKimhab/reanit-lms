import type { Mailer } from "../auth";
import type { CommentPosted, CourseCompleted, OrderPaid } from "../events";
import { ReceiptNotFoundError } from "./errors";
import type { ComposedEmail, ReceiptStore, StaffEmailBase, StaffEmailComposer, StaffNoticeStore } from "./ports";
import { appPageUrl, NOTIFICATION_ROLES, type NotificationKind } from "./rules";

/** Dashboard pages each staff email links to. */
const SALES_PATH = "/dashboard/analytics";
const INBOX_PATH = "/dashboard/comments";
const STUDENTS_PATH = "/dashboard/students";
/** The settings page's email section, linked from every staff email's footer. */
const PREFERENCES_PATH = "/dashboard/settings#notifications";

/** What `createStaffNotifications` needs. */
export interface StaffNotificationDependencies {
  /** Builds one school's staff notice store; events name their school. */
  noticesFor: (schoolId: string) => StaffNoticeStore;
  /** Builds one school's receipt store, for what a sale was. */
  receiptsFor: (schoolId: string) => ReceiptStore;
  mailer: Mailer;
  composer: StaffEmailComposer;
  /** Public origin of the web app, for links. */
  appUrl: string;
}

/**
 * Builds the emails a school's staff get when something happens in it: a sale, a student's comment,
 * a completed course. Each goes to the staff whose role it concerns and who have not turned it off,
 * in each reader's language, with a link that turns that kind off.
 *
 * @param dependencies Notice and receipt stores, mailer, composer and the web app's origin.
 * @param dependencies.noticesFor Builds one school's staff notice store.
 * @param dependencies.receiptsFor Builds one school's receipt store.
 * @param dependencies.mailer Sends the emails.
 * @param dependencies.composer Writes them.
 * @param dependencies.appUrl Public origin of the web app.
 * @returns The staff notification operations, one per event.
 * @example
 * const staff = createStaffNotifications({ noticesFor, receiptsFor, mailer, composer: staffEmailComposer, appUrl: env.APP_URL });
 * await staff.notifySale(event);
 */
export function createStaffNotifications({ noticesFor, receiptsFor, mailer, composer, appUrl }: StaffNotificationDependencies) {
  /**
   * Emails one kind of news to every staff member who gets it.
   *
   * @param notices The school's staff notice store.
   * @param kind The kind of email.
   * @param schoolName The school the news is about.
   * @param write Writes one recipient's email from the parts every staff email shares.
   */
  async function sendToStaff(
    notices: StaffNoticeStore,
    kind: NotificationKind,
    schoolName: string,
    write: (base: StaffEmailBase) => Promise<ComposedEmail>,
  ): Promise<void> {
    for (const { email, locale, unsubscribeToken } of await notices.findRecipients(kind, NOTIFICATION_ROLES[kind])) {
      const query = new URLSearchParams({ token: unsubscribeToken, kind });
      const unsubscribeUrl = appPageUrl({ appUrl, locale, path: `/unsubscribe?${query}` });
      const preferencesUrl = appPageUrl({ appUrl, locale, path: PREFERENCES_PATH });
      await mailer.send({ to: email, unsubscribeUrl, ...(await write({ locale, schoolName, unsubscribeUrl, preferencesUrl })) });
    }
  }

  /**
   * Links a recipient to a dashboard page in their language.
   *
   * @param base The recipient's shared email parts.
   * @param base.locale Their language.
   * @param path The dashboard page.
   * @returns The URL.
   */
  function dashboardUrl({ locale }: StaffEmailBase, path: string) {
    return appPageUrl({ appUrl, locale, path });
  }

  return {
    /**
     * Tells the owners and admins about a sale: who bought what, for how much.
     *
     * @param event The `OrderPaid` event.
     * @param event.schoolId The school that sold the order.
     * @param event.payload The order.
     * @throws {ReceiptNotFoundError} When the school has no paid order with the event's id.
     */
    async notifySale({ schoolId, payload }: OrderPaid): Promise<void> {
      const receipt = await receiptsFor(schoolId).findReceipt(payload.orderId);
      if (!receipt) throw new ReceiptNotFoundError();
      await sendToStaff(noticesFor(schoolId), "newSale", receipt.school.name, (base) =>
        composer.newSale({
          ...base,
          buyer: receipt.buyer,
          courseTitles: receipt.items.map((item) => item.title),
          total: receipt.total,
          salesUrl: dashboardUrl(base, SALES_PATH),
        }),
      );
    },

    /**
     * Tells the staff about a student's comment, with a link to the comments inbox. Comments by staff,
     * and comments deleted before this runs, send nothing.
     *
     * @param event The `CommentPosted` event.
     * @param event.schoolId The school.
     * @param event.payload The comment.
     */
    async notifyComment({ schoolId, payload }: CommentPosted): Promise<void> {
      const notices = noticesFor(schoolId);
      const comment = await notices.findComment(payload.commentId);
      if (!comment || comment.isStaffAuthor) return;
      const { authorName, body, lessonTitle, courseTitle } = comment;
      await sendToStaff(notices, "newComment", comment.schoolName, (base) =>
        composer.newComment({ ...base, authorName, body, lessonTitle, courseTitle, inboxUrl: dashboardUrl(base, INBOX_PATH) }),
      );
    },

    /**
     * Tells the staff that a student completed a course. An enrollment removed before this runs sends nothing.
     *
     * @param event The `CourseCompleted` event.
     * @param event.schoolId The school.
     * @param event.payload The completed enrollment.
     */
    async notifyCompletion({ schoolId, payload }: CourseCompleted): Promise<void> {
      const notices = noticesFor(schoolId);
      const completion = await notices.findCompletion(payload.enrollmentId);
      if (!completion) return;
      const { schoolName, ...details } = completion;
      await sendToStaff(notices, "courseCompleted", schoolName, (base) =>
        composer.courseCompleted({ ...base, ...details, studentsUrl: dashboardUrl(base, STUDENTS_PATH) }),
      );
    },
  };
}

/** The staff notification use cases. */
export type StaffNotifications = ReturnType<typeof createStaffNotifications>;
