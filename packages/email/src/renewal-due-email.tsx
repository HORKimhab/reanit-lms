import { Text } from "@react-email/components";
import type { RenewalNotice } from "@reanit/core/notifications";

import { emailIntl } from "./intl";
import { EmailLayout } from "./layout";

/** What a renewal email says. */
export interface RenewalDue {
  notice: RenewalNotice;
  /** The grace period's last day, rather than the coming end of the period. */
  isLastDay: boolean;
  /** When access ends unpaid. */
  accessUntil: Date;
  /** The student's purchases page, where they pay. */
  payUrl: string;
}

/**
 * Asks a student to pay their subscription's next period or their plan's next instalment: before the
 * period ends, or on the last day before their access ends.
 *
 * @param props - Email props, as `RenewalDue` describes them.
 * @param props.notice - The subscription.
 * @param props.isLastDay - Whether it is the grace period's last day.
 * @param props.accessUntil - When access ends unpaid.
 * @param props.payUrl - Where to pay.
 * @returns The email document.
 */
export function RenewalDueEmail({ notice, isLastDay, accessUntil, payUrl }: RenewalDue) {
  const { t, format, money } = emailIntl(notice.locale);
  const { student, school, title, billing } = notice;
  const amount = money(notice.price);
  const periodEnd = format.dateTime(notice.currentPeriodEnd, { dateStyle: "long" });
  const due =
    billing.kind === "payment_plan"
      ? t("Renewal.installment", { title, school: school.name, next: notice.paidPeriods + 1, total: billing.installments, date: periodEnd, amount })
      : t(`Renewal.${billing.interval}`, { title, school: school.name, date: periodEnd, amount });
  const accessEnd = t("Renewal.accessEnds", { title, date: format.dateTime(accessUntil, { dateStyle: "long" }) });

  return (
    <EmailLayout
      lang={notice.locale}
      preview={isLastDay ? accessEnd : due}
      heading={t(isLastDay ? "Renewal.lastDayHeading" : "Renewal.heading", { title })}
      action={{ label: t("Renewal.button", { amount }), href: payUrl }}
      footer={t("Common.sentBy", { school: school.name })}
    >
      <Text>{student.name ? t("Common.greeting", { name: student.name }) : t("Common.greetingNoName")}</Text>
      <Text>{due}</Text>
      <Text>{accessEnd}</Text>
    </EmailLayout>
  );
}
