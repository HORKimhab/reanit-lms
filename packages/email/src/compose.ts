import { render } from "@react-email/render";
import type { ComposedEmail, EmailLocale, PurchaseEmailComposer, StaffEmailComposer } from "@reanit/core/notifications";
import { createElement, type ReactElement } from "react";

import { CourseWelcomeEmail } from "./course-welcome-email";
import { emailIntl } from "./intl";
import { MagicLinkEmail } from "./magic-link-email";
import { PurchaseReceiptEmail } from "./purchase-receipt-email";
import { CourseCompletedEmail, NewCommentEmail, NewSaleEmail } from "./staff-emails";

/**
 * Renders an email to the HTML and plain-text bodies every message carries.
 *
 * @param subject The subject line.
 * @param email The email document.
 * @returns Subject, HTML and text.
 */
async function compose(subject: string, email: ReactElement): Promise<ComposedEmail> {
  const [html, text] = await Promise.all([render(email), render(email, { plainText: true })]);
  return { subject, html, text };
}

/**
 * Writes the one-time sign-in email.
 *
 * @param email What the email says.
 * @param email.locale The reader's language.
 * @param email.url The sign-in link.
 * @param email.minutes How long the link works.
 * @returns Subject and bodies, without the recipient.
 * @example
 * await auth.requestMagicLink(email, (token) => composeMagicLinkEmail({ locale, url: linkFor(token), minutes: 15 }));
 */
export function composeMagicLinkEmail(email: { locale: EmailLocale; url: string; minutes: number }): Promise<ComposedEmail> {
  return compose(emailIntl(email.locale).t("MagicLink.subject"), createElement(MagicLinkEmail, email));
}

/**
 * Writes a purchase's receipt and course welcomes, as `createPurchaseEmails` in `@reanit/core/notifications` sends them.
 *
 * @example
 * createPurchaseEmails({ receiptsFor, mailer, composer: purchaseEmailComposer, appUrl });
 */
export const purchaseEmailComposer: PurchaseEmailComposer = {
  /**
   * Writes the receipt of a paid order.
   *
   * @param email The receipt and the buyer's courses page.
   * @returns Subject and bodies.
   */
  purchaseReceipt(email) {
    const { t } = emailIntl(email.receipt.locale);
    return compose(t("Receipt.subject", { school: email.receipt.school.name }), createElement(PurchaseReceiptEmail, email));
  },

  /**
   * Writes the welcome to a course the buyer now has.
   *
   * @param email The course, the buyer and the link to start.
   * @returns Subject and bodies.
   */
  courseWelcome(email) {
    return compose(emailIntl(email.locale).t("Welcome.subject", { course: email.courseTitle }), createElement(CourseWelcomeEmail, email));
  },
};

/**
 * Writes the emails a school's staff get about it, as `createStaffNotifications` in `@reanit/core/notifications` sends them.
 *
 * @example
 * createStaffNotifications({ noticesFor, receiptsFor, mailer, composer: staffEmailComposer, appUrl });
 */
export const staffEmailComposer: StaffEmailComposer = {
  /**
   * Writes the email about a sale.
   *
   * @param email The sale, the reader's language and the links.
   * @returns Subject and bodies.
   */
  newSale(email) {
    const { t, format } = emailIntl(email.locale);
    return compose(t("NewSale.subject", { courses: format.list(email.courseTitles) }), createElement(NewSaleEmail, email));
  },

  /**
   * Writes the email about a student's comment.
   *
   * @param email The comment, the reader's language and the links.
   * @returns Subject and bodies.
   */
  newComment(email) {
    return compose(emailIntl(email.locale).t("NewComment.subject", { lesson: email.lessonTitle }), createElement(NewCommentEmail, email));
  },

  /**
   * Writes the email about a completed course.
   *
   * @param email The completion, the reader's language and the links.
   * @returns Subject and bodies.
   */
  courseCompleted(email) {
    const subject = emailIntl(email.locale).t("CourseCompleted.subject", { student: email.studentName ?? email.studentEmail, course: email.courseTitle });
    return compose(subject, createElement(CourseCompletedEmail, email));
  },
};
