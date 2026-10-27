import type { Payout } from "@reanit/core/commerce";
import { useFormatter, useTranslations } from "next-intl";

import { Cell, DataTable, RowHeader } from "@/components/dashboard/data-table";
import { useMoney } from "@/i18n/format";

/**
 * The transfers the platform made to the school, newest first.
 *
 * @param props - Component props.
 * @param props.payouts - The payouts, in display order.
 * @returns A labelled section with a table of payouts, or a line saying there is none yet.
 */
export function PayoutHistory({ payouts }: { payouts: Payout[] }) {
  const t = useTranslations("Payouts");
  const format = useFormatter();
  const money = useMoney();

  return (
    <section aria-labelledby="payout-history" className="flex flex-col gap-3">
      <h2 id="payout-history" className="text-lg font-semibold">
        {t("historyTitle")}
      </h2>
      {payouts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noPayouts")}</p>
      ) : (
        <DataTable caption={t("historyTitle")} columns={[{ label: t("paidAt") }, { label: t("amount"), isNumeric: true }, { label: t("reference") }]}>
          {payouts.map((payout) => (
            <tr key={payout.id}>
              <RowHeader>{format.dateTime(payout.paidAt, { dateStyle: "medium" })}</RowHeader>
              <Cell isNumeric>{money(payout.amount, payout.currency)}</Cell>
              <Cell>{payout.reference}</Cell>
            </tr>
          ))}
        </DataTable>
      )}
    </section>
  );
}
