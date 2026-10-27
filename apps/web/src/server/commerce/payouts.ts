import type { Currency, CurrencyBalance, Payout, PayoutAccount } from "@reanit/core/commerce";

import { getApi } from "../api";
import { checkStaffResponse } from "../schools/staff";

/** The payouts page's path, refreshed after the owner saves the payout details. */
export const PAYOUTS_PATH = "/dashboard/payouts";

/** What the platform owes the school, when and above what it pays out, where it sends it, and what it paid. */
export interface SchoolPayouts {
  balances: CurrencyBalance[];
  nextPayoutDate: Date;
  /** Smallest balance paid out, per currency, in minor units. */
  minimums: Record<Currency, number>;
  account: PayoutAccount | null;
  /** Newest first. */
  payouts: Payout[];
}

/**
 * Loads the signed-in owner's or admin's school's balances, payout details and payouts.
 *
 * @returns The school's payouts, with dates as dates.
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
export async function getSchoolPayouts(): Promise<SchoolPayouts> {
  const { data, response } = await (await getApi()).GET("/schools/current/payouts");
  checkStaffResponse(response);
  // checkStaffResponse returned, so the API answered 2xx with the payouts.
  const { nextPayoutDate, payouts, ...rest } = data!;
  return { ...rest, nextPayoutDate: new Date(nextPayoutDate), payouts: payouts.map((payout) => ({ ...payout, paidAt: new Date(payout.paidAt) })) };
}
