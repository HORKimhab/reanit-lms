"use client";

import { GATEWAY_REFUND_METHODS, type OrderDetail } from "@reanit/core/commerce";
import { useTranslations } from "next-intl";

import { ConfirmButton } from "@/components/form/confirm-button";
import { useMoney } from "@/i18n/format";

/**
 * Refunds a paid order after a second confirmation. Stripe refunds the card itself; for KHQR and
 * PayWay, staff confirm they already paid the student back. Either way the student loses the courses.
 *
 * @param props - Component props.
 * @param props.order - The paid order.
 * @param props.refund - Refunds it; told whether staff refunded by hand.
 * @returns The refund button, or the warning with confirm and cancel buttons.
 */
export function RefundButton({ order, refund }: { order: OrderDetail; refund: (isRefundedByHand: boolean) => Promise<void> }) {
  const t = useTranslations("Refund");
  const methods = useTranslations("Checkout.methods");
  const money = useMoney();
  const amount = money(order.total.amount, order.total.currency);
  const isByGateway = GATEWAY_REFUND_METHODS.includes(order.method);

  return (
    <ConfirmButton
      action={() => refund(!isByGateway)}
      labels={{
        trigger: t("trigger"),
        warning: isByGateway ? t("gatewayWarning", { amount }) : t("byHandWarning", { amount, method: methods(order.method) }),
        confirm: isByGateway ? t("confirmGateway", { amount }) : t("confirmByHand"),
        pending: t("refunding"),
        cancel: t("cancel"),
      }}
    />
  );
}
