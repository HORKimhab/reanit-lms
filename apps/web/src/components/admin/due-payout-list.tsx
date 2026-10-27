import type { DuePayout } from "@reanit/core/commerce";
import { useTranslations } from "next-intl";

import type { RecordPayoutState } from "@/app/[locale]/admin/actions";
import { EmptyState } from "@/components/shells/empty-state";
import { useMoney } from "@/i18n/format";

import { RecordPayoutForm } from "./record-payout-form";

/**
 * The payouts due, one card each: the school, the amount, where to send it, and the form to record the
 * transfer once it is made.
 *
 * @param props - Component props.
 * @param props.payouts - The payouts due.
 * @param props.record - Records a transfer.
 * @returns The cards, or an empty state.
 */
export function DuePayoutList({ payouts, record }: { payouts: DuePayout[]; record: (state: RecordPayoutState, formData: FormData) => Promise<RecordPayoutState> }) {
  const t = useTranslations("Admin.payouts");
  const money = useMoney();

  if (payouts.length === 0) return <EmptyState title={t("emptyTitle")} text={t("empty")} />;

  return (
    <ul className="flex flex-col gap-4">
      {payouts.map((due) => (
        <li key={`${due.school.id}-${due.currency}`} aria-labelledby={`due-${due.school.id}-${due.currency}`} className="flex flex-col gap-3 rounded-xl border p-5">
          <h2 id={`due-${due.school.id}-${due.currency}`} className="font-semibold">
            {t("due", { school: due.school.name, amount: money(due.amount, due.currency) })}
          </h2>
          {due.account ? (
            <p className="text-sm">{t("sendTo", { holder: due.account.holderName, bank: due.account.bankName, account: due.account.account })}</p>
          ) : (
            <p role="alert" className="text-sm text-destructive">
              {t("noAccount")}
            </p>
          )}
          <RecordPayoutForm due={due} record={record} />
        </li>
      ))}
    </ul>
  );
}
