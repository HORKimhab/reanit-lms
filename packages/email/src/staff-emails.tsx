import { Text } from "@react-email/components";
import { moneyFormat } from "@reanit/core/commerce";
import type { StaffEmailBase, StaffEmailComposer } from "@reanit/core/notifications";
import type * as React from "react";

import { emailIntl } from "./intl";
import { EmailLayout } from "./layout";

/** What the sale email is written from. */
type NewSaleEmailProps = Parameters<StaffEmailComposer["newSale"]>[0];
/** What the comment email is written from. */
type NewCommentEmailProps = Parameters<StaffEmailComposer["newComment"]>[0];
/** What the completion email is written from. */
type CourseCompletedEmailProps = Parameters<StaffEmailComposer["courseCompleted"]>[0];

/**
 * The frame of every staff email: the shared layout with a footer saying why it came, and links that
 * stop this kind of email or open the email settings.
 *
 * @param props - Email props.
 * @param props.base - The reader's language, the school and the footer links.
 * @param props.preview - Inbox preview line.
 * @param props.heading - The card's heading.
 * @param props.action - The button's label and link.
 * @param props.action.label - What the button says.
 * @param props.action.href - Where it goes.
 * @param props.children - The body.
 * @returns The email document.
 */
function StaffEmail({
  base,
  preview,
  heading,
  action,
  children,
}: {
  base: StaffEmailBase;
  preview: string;
  heading: string;
  action: { label: string; href: string };
  children: React.ReactNode;
}) {
  const { t } = emailIntl(base.locale);
  return (
    <EmailLayout
      lang={base.locale}
      preview={preview}
      heading={heading}
      action={action}
      footer={t("Staff.footer", { school: base.schoolName })}
      footerLinks={[
        { label: t("Staff.unsubscribe"), href: base.unsubscribeUrl },
        { label: t("Staff.preferences"), href: base.preferencesUrl },
      ]}
    >
      {children}
    </EmailLayout>
  );
}

/**
 * Tells staff about a sale: who bought which courses, for how much.
 *
 * @param props - Email props: the sale and the shared staff email parts.
 * @returns The email document.
 */
export function NewSaleEmail(props: NewSaleEmailProps) {
  const { t, format } = emailIntl(props.locale);
  const { value, options } = moneyFormat(props.total.amount, props.total.currency);
  const body = t("NewSale.body", {
    buyer: props.buyer.name ? t("Staff.buyerNamed", { name: props.buyer.name, email: props.buyer.email }) : props.buyer.email,
    courses: format.list(props.courseTitles),
    school: props.schoolName,
    total: format.number(value, options),
  });
  return (
    <StaffEmail base={props} preview={body} heading={t("NewSale.heading")} action={{ label: t("NewSale.button"), href: props.salesUrl }}>
      <Text>{body}</Text>
    </StaffEmail>
  );
}

/**
 * Tells staff about a student's comment, quoting it.
 *
 * @param props - Email props: the comment and the shared staff email parts.
 * @returns The email document.
 */
export function NewCommentEmail(props: NewCommentEmailProps) {
  const { t } = emailIntl(props.locale);
  const intro = t("NewComment.body", { author: props.authorName ?? t("Staff.someone"), lesson: props.lessonTitle, course: props.courseTitle });
  return (
    <StaffEmail
      base={props}
      preview={`${intro} ${props.body}`}
      heading={t("NewComment.heading")}
      action={{ label: t("NewComment.button"), href: props.inboxUrl }}
    >
      <Text>{intro}</Text>
      <Text style={{ borderLeft: "3px solid #e4e4e7", color: "#3f3f46", margin: "0 0 24px", paddingLeft: 12, whiteSpace: "pre-wrap" }}>{props.body}</Text>
    </StaffEmail>
  );
}

/**
 * Tells staff that a student completed a course.
 *
 * @param props - Email props: the completion and the shared staff email parts.
 * @returns The email document.
 */
export function CourseCompletedEmail(props: CourseCompletedEmailProps) {
  const { t } = emailIntl(props.locale);
  const body = t("CourseCompleted.body", { student: props.studentName ?? props.studentEmail, course: props.courseTitle, school: props.schoolName });
  return (
    <StaffEmail base={props} preview={body} heading={t("CourseCompleted.heading")} action={{ label: t("CourseCompleted.button"), href: props.studentsUrl }}>
      <Text>{body}</Text>
    </StaffEmail>
  );
}
