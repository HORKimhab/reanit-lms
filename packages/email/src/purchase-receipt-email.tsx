import { Column, Row, Section, Text } from "@react-email/components";
import { orderReference } from "@reanit/core/commerce";
import type { OrderReceipt } from "@reanit/core/notifications";

import { emailIntl } from "./intl";
import { EmailLayout } from "./layout";

/**
 * The receipt for a paid order: what was bought, at what price, and when.
 *
 * @param props - Email props.
 * @param props.receipt - The paid order.
 * @param props.myCoursesUrl - The buyer's courses page on the school site.
 * @returns The email document.
 */
export function PurchaseReceiptEmail({ receipt, myCoursesUrl }: { receipt: OrderReceipt; myCoursesUrl: string }) {
  const { t, format, money } = emailIntl(receipt.locale);
  const { buyer, school, items, total } = receipt;

  return (
    <EmailLayout
      lang={receipt.locale}
      preview={t("Receipt.intro", { school: school.name })}
      heading={t("Receipt.heading")}
      action={{ label: t("Receipt.button"), href: myCoursesUrl }}
      footer={t("Common.sentBy", { school: school.name })}
    >
      <Text>{buyer.name ? t("Common.greeting", { name: buyer.name }) : t("Common.greetingNoName")}</Text>
      <Text>{t("Receipt.intro", { school: school.name })}</Text>
      <Text style={{ color: "#71717a", fontSize: 13 }}>
        {t("Receipt.order", { id: orderReference(receipt.orderId) })}
        {" · "}
        {t("Receipt.paidAt", { date: format.dateTime(receipt.paidAt, { dateStyle: "medium", timeStyle: "short" }) })}
      </Text>
      <Section style={{ margin: "16px 0 24px" }}>
        <Row style={{ color: "#71717a", fontSize: 13 }}>
          <Column>{t("Receipt.course")}</Column>
          <Column align="right">{t("Receipt.amount")}</Column>
        </Row>
        {items.map((item) => (
          <Row key={item.slug}>
            <Column>{item.title}</Column>
            <Column align="right">{money(item)}</Column>
          </Row>
        ))}
        <Row style={{ fontWeight: 600 }}>
          <Column>{t("Receipt.total")}</Column>
          <Column align="right">{money(total)}</Column>
        </Row>
      </Section>
    </EmailLayout>
  );
}
