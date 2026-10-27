import { PLAN_CURRENCY, type SubmittedPlanPayment } from "@reanit/core/schools";
import { useFormatter, useTranslations } from "next-intl";

import { Cell, DataTable, RowHeader } from "@/components/dashboard/data-table";
import { ConfirmButton } from "@/components/form/confirm-button";
import { EmptyState } from "@/components/shells/empty-state";
import { useMoney } from "@/i18n/format";

/**
 * Creators' transfers to the platform's QR waiting for an admin, oldest first: who paid for which plan,
 * how much, and the reference to look for in the platform's account, with confirm and reject buttons
 * that each ask twice.
 *
 * @param props - Component props.
 * @param props.payments - The payments.
 * @param props.decide - Confirms or rejects a payment.
 * @returns The table, or an empty state.
 */
export function PlanPaymentTable({ payments, decide }: { payments: SubmittedPlanPayment[]; decide: (paymentId: string, decision: "confirm" | "reject") => Promise<void> }) {
  const t = useTranslations("Admin.planPayments");
  const plans = useTranslations("Plans");
  const format = useFormatter();
  const money = useMoney();

  if (payments.length === 0) return <EmptyState title={t("emptyTitle")} text={t("empty")} />;

  return (
    <DataTable
      caption={t("caption")}
      columns={[{ label: t("school") }, { label: t("plan") }, { label: t("amount"), isNumeric: true }, { label: t("reference") }, { label: t("submitted") }, { label: t("actions") }]}
    >
      {payments.map((payment) => {
        const amount = money(payment.amount, PLAN_CURRENCY);
        return (
          <tr key={payment.id}>
            <RowHeader>
              {payment.school.name}
              <span className="block font-mono text-xs font-normal text-muted-foreground">{payment.school.subdomain}</span>
            </RowHeader>
            <Cell>{t("planFor", { plan: plans(`names.${payment.plan}`), interval: plans(`intervals.${payment.interval}`) })}</Cell>
            <Cell isNumeric>{amount}</Cell>
            <Cell>
              <span className="font-mono">{payment.reference}</span>
            </Cell>
            <Cell>{format.dateTime(payment.submittedAt, { dateStyle: "medium", timeStyle: "short" })}</Cell>
            <Cell>
              <div className="flex flex-wrap gap-2">
                <ConfirmButton
                  action={() => decide(payment.id, "confirm")}
                  labels={{ trigger: t("confirm"), warning: t("confirmWarning", { amount, reference: payment.reference }), confirm: t("confirmYes"), pending: t("saving"), cancel: t("cancel") }}
                />
                <ConfirmButton
                  action={() => decide(payment.id, "reject")}
                  labels={{ trigger: t("reject"), warning: t("rejectWarning"), confirm: t("rejectYes"), pending: t("saving"), cancel: t("cancel") }}
                />
              </div>
            </Cell>
          </tr>
        );
      })}
    </DataTable>
  );
}
