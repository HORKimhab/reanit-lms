"use client";

import type { OrderDetail } from "@reanit/core/commerce";
import { useTranslations } from "next-intl";

import { ConfirmButton } from "@/components/form/confirm-button";
import { useMoney } from "@/i18n/format";

/**
 * Lets staff settle an offline QR payment once they have checked the school's account: confirm it,
 * which enrolls the student, or reject it, which fails the order. Both ask twice.
 *
 * @param props - Component props.
 * @param props.order - An offline QR order still waiting for payment or confirmation.
 * @param props.review - Confirms or rejects it; bound to the order.
 * @returns The student's transaction reference (if they gave one) with the confirm and reject buttons.
 */
export function OfflinePaymentReview({ order, review }: { order: OrderDetail; review: (decision: "confirm" | "reject") => Promise<void> }) {
  const t = useTranslations("OfflineReview");
  const money = useMoney();
  const amount = money(order.total.amount, order.total.currency);

  return (
    <section aria-labelledby="offline-review" className="flex flex-col gap-3 rounded-xl border p-5">
      <h2 id="offline-review" className="font-semibold">
        {t("title")}
      </h2>
      <p className="text-sm">{order.paymentReference ? t("reference", { reference: order.paymentReference, amount }) : t("noReference", { amount })}</p>
      <div className="flex flex-wrap gap-3">
        <ConfirmButton
          action={() => review("confirm")}
          labels={{ trigger: t("confirm"), warning: t("confirmWarning", { amount }), confirm: t("confirmYes"), pending: t("saving"), cancel: t("cancel") }}
        />
        <ConfirmButton
          action={() => review("reject")}
          labels={{ trigger: t("reject"), warning: t("rejectWarning"), confirm: t("rejectYes"), pending: t("saving"), cancel: t("cancel") }}
        />
      </div>
    </section>
  );
}
