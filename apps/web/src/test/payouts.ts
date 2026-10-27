import { PAYOUT_MINIMUMS } from "@reanit/core/commerce";

import type { SchoolPayouts } from "@/server/commerce/payouts";

/** A school's payouts as `GET /schools/current/payouts` answers. */
export const PAYOUTS_JSON = {
  balances: [
    { currency: "USD", available: 12_345, onHold: 2_000 },
    { currency: "KHR", available: -400_000, onHold: 0 },
  ],
  nextPayoutDate: "2026-11-01T00:00:00.000Z",
  minimums: PAYOUT_MINIMUMS,
  account: { holderName: "Dara Kim", bankName: "ABA", account: "000 123 456" },
  payouts: [{ id: "3a1f6c8e-1b2d-4e5f-8a9b-0c1d2e3f4a5b", currency: "USD", amount: 5_000, paidAt: "2026-10-01T03:00:00.000Z", reference: "ABA-778" }],
} as const;

/** The same payouts as the web app holds them, dates parsed. */
export const SCHOOL_PAYOUTS: SchoolPayouts = {
  balances: PAYOUTS_JSON.balances.map((balance) => ({ ...balance })),
  nextPayoutDate: new Date(PAYOUTS_JSON.nextPayoutDate),
  minimums: PAYOUT_MINIMUMS,
  account: { ...PAYOUTS_JSON.account },
  payouts: PAYOUTS_JSON.payouts.map((payout) => ({ ...payout, paidAt: new Date(payout.paidAt) })),
};
