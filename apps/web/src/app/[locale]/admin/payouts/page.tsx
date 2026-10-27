import { getTranslations } from "next-intl/server";

import { DuePayoutList } from "@/components/admin/due-payout-list";
import { getDuePayouts } from "@/server/admin/console";

import { recordPayout } from "../actions";

/**
 * The payouts due to schools, with where to send each and recording the transfers made.
 *
 * @returns The page heading and the payouts due.
 */
export default async function AdminPayouts() {
  const [t, payouts] = await Promise.all([getTranslations("Admin"), getDuePayouts()]);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav.payouts")}</h1>
      <p className="text-sm text-muted-foreground">{t("payouts.intro")}</p>
      <DuePayoutList payouts={payouts} record={recordPayout} />
    </div>
  );
}
