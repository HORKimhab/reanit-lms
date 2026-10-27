import { CURRENCIES, PAYOUT_HOLD_DAYS } from "@reanit/core/commerce";
import { useFormatter, useTranslations } from "next-intl";

import { Cell, DataTable, RowHeader } from "@/components/dashboard/data-table";
import { useMoney } from "@/i18n/format";
import type { SchoolPayouts } from "@/server/commerce/payouts";

/** Payouts go out on the 1st in UTC, so the date reads the same wherever the owner is. */
const PAYOUT_TIME_ZONE = "UTC";

/**
 * What the platform owes the school in each currency, paid out now or still held, with when the next
 * payout goes out and the smallest balance it pays.
 *
 * @param props - Component props.
 * @param props.payouts - The school's payouts; only the balances, next date and minimums are shown.
 * @returns A labelled section with a table of balances, or a line saying there is none yet.
 */
export function PayoutBalances({ payouts }: { payouts: Pick<SchoolPayouts, "balances" | "nextPayoutDate" | "minimums"> }) {
  const t = useTranslations("Payouts");
  const format = useFormatter();
  const money = useMoney();
  const { balances, nextPayoutDate, minimums } = payouts;
  const minimum = format.list(CURRENCIES.map((currency) => money(minimums[currency], currency)));

  return (
    <section aria-labelledby="payout-balances" className="flex flex-col gap-3">
      <h2 id="payout-balances" className="text-lg font-semibold">
        {t("balanceTitle")}
      </h2>
      {balances.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noBalance")}</p>
      ) : (
        <DataTable caption={t("balanceTitle")} columns={[{ label: t("currency") }, { label: t("available"), isNumeric: true }, { label: t("onHold"), isNumeric: true }]}>
          {balances.map(({ currency, available, onHold }) => (
            <tr key={currency}>
              <RowHeader>{currency}</RowHeader>
              <Cell isNumeric>{money(available, currency)}</Cell>
              <Cell isNumeric>{money(onHold, currency)}</Cell>
            </tr>
          ))}
        </DataTable>
      )}
      <p className="text-sm">{t("nextPayout", { date: format.dateTime(nextPayoutDate, { dateStyle: "medium", timeZone: PAYOUT_TIME_ZONE }), minimum })}</p>
      <p className="text-sm text-muted-foreground">{t("holdNote", { days: PAYOUT_HOLD_DAYS })}</p>
      {balances.some(({ available }) => available < 0) ? <p className="text-sm text-muted-foreground">{t("negativeNote")}</p> : null}
    </section>
  );
}
