import { getTranslations } from "next-intl/server";

import { PayoutAccountForm } from "@/components/payouts/payout-account-form";
import { PayoutAccountSummary } from "@/components/payouts/payout-account-summary";
import { PayoutBalances } from "@/components/payouts/payout-balances";
import { PayoutHistory } from "@/components/payouts/payout-history";
import { getSchoolPayouts } from "@/server/commerce/payouts";
import { canManageSchool, getStaffSchool } from "@/server/schools/staff";

import { savePayoutAccount } from "./actions";

/**
 * The school's payouts: what the platform owes it per currency, when it pays, where it sends the money,
 * which only the owner changes, and what it paid. Instructors see why they cannot see it.
 *
 * @returns The page heading and the payouts, or a notice for instructors.
 */
export default async function DashboardPayouts() {
  const [t, nav, { role }] = await Promise.all([getTranslations("Payouts"), getTranslations("DashboardNav"), getStaffSchool()]);
  if (!canManageSchool(role)) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">{nav("payouts")}</h1>
        <p className="text-sm text-muted-foreground">{t("staffOnly")}</p>
      </div>
    );
  }
  const payouts = await getSchoolPayouts();
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">{nav("payouts")}</h1>
      <PayoutBalances payouts={payouts} />
      {role === "owner" ? <PayoutAccountForm account={payouts.account} save={savePayoutAccount} /> : <PayoutAccountSummary account={payouts.account} />}
      <PayoutHistory payouts={payouts.payouts} />
    </div>
  );
}
