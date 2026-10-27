import { z } from "zod";

import type { Clock } from "../auth";
import { PayoutExceedsBalanceError } from "./errors";
import { CURRENCIES, minorStep, type Currency } from "./rules";

/** Days a gateway sale is held before it can be paid out, so refunds never leave the platform short. */
export const PAYOUT_HOLD_DAYS = 7;

/** Smallest balance paid out, per currency, in minor units: $10, and 40,000 riel. */
export const PAYOUT_MINIMUMS: Record<Currency, number> = { USD: 1000, KHR: 4_000_000 };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Longest account holder, bank name or transfer reference. */
export const PAYOUT_TEXT_MAX_LENGTH = 100;
/** Longest account number or Bakong ID. */
export const PAYOUT_ACCOUNT_MAX_LENGTH = 64;

/** Where a school's payouts are sent: the account holder, the bank, and the account number or Bakong ID. */
export const payoutAccountSchema = z.object({
  holderName: z.string().trim().min(1).max(PAYOUT_TEXT_MAX_LENGTH),
  bankName: z.string().trim().min(1).max(PAYOUT_TEXT_MAX_LENGTH),
  account: z.string().trim().min(1).max(PAYOUT_ACCOUNT_MAX_LENGTH),
});

/** A transfer a platform admin made to a school: how much, in which currency, when, and the bank's reference. */
export const recordPayoutSchema = z
  .object({
    schoolId: z.uuid(),
    currency: z.enum(CURRENCIES),
    amount: z.number().int().positive(),
    paidAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
    reference: z.string().trim().min(1).max(PAYOUT_TEXT_MAX_LENGTH),
  })
  .refine(({ amount, currency }) => amount % minorStep(currency) === 0, { message: "KHR amounts are whole riel", path: ["amount"] });

/** Parsed payout details. */
export type PayoutAccount = z.infer<typeof payoutAccountSchema>;

/** Parsed payout record. */
export type RecordPayoutInput = z.infer<typeof recordPayoutSchema>;

/** What the platform owes a school in one currency, in minor units. */
export interface CurrencyBalance {
  currency: Currency;
  /** Can be paid out now; negative when the school owes fees on its own QR sales. */
  available: number;
  /** Gateway sales still within their hold. */
  onHold: number;
}

/** A transfer made to a school. */
export interface Payout {
  id: string;
  currency: Currency;
  amount: number;
  paidAt: Date;
  reference: string;
}

/** One school's balances, payouts and payout details. `@reanit/db` implements it with `createPayoutStore`. */
export interface PayoutStore {
  /** The school's balance per currency it ever sold or was paid in; sales paid at or before `payableBefore` are past their hold. */
  balances(payableBefore: Date): Promise<CurrencyBalance[]>;
  /** The school's payouts, newest first. */
  listPayouts(): Promise<Payout[]>;
  findPayoutAccount(): Promise<PayoutAccount | null>;
  savePayoutAccount(account: PayoutAccount): Promise<PayoutAccount>;
}

/** A school's balances with where to send them, for platform admins. */
export interface SchoolBalances {
  school: { id: string; name: string; subdomain: string };
  account: PayoutAccount | null;
  balances: CurrencyBalance[];
}

/** Every school's balances and payouts, for platform admins. `@reanit/db` implements it with `createPayoutAdminStore`. */
export interface PayoutAdminStore {
  /** Every school that has a balance, with its payout details. */
  listBalances(payableBefore: Date): Promise<SchoolBalances[]>;
  /**
   * Records a payout, unless it is more than the school's available balance in its currency, checked in
   * the same transaction, noting the admin who recorded it. Returns null when it is more, or when no school has the id.
   */
  recordPayout(payout: RecordPayoutInput, payableBefore: Date, recordedById: string): Promise<Payout | null>;
}

/**
 * Gives the day payouts are next made: the 1st of the month, in UTC; today when today is the 1st.
 *
 * @param now The current time.
 * @returns Midnight UTC of that day.
 * @example
 * nextPayoutDate(new Date("2026-10-27T12:00:00Z")); // 2026-11-01T00:00:00Z
 */
export function nextPayoutDate(now: Date): Date {
  const isFirst = now.getUTCDate() === 1;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + (isFirst ? 0 : 1), 1));
}

/**
 * Tells when a sale paid now stops being held: anything paid at or before the returned moment can be paid out.
 *
 * @param now The current time.
 * @returns The moment `PAYOUT_HOLD_DAYS` ago.
 */
function payableBefore(now: Date): Date {
  return new Date(now.getTime() - PAYOUT_HOLD_DAYS * DAY_MS);
}

/**
 * Builds one school's payout use cases for its owner: the balance, the payout details and the payouts made.
 *
 * @param dependencies The school's payouts and the clock.
 * @param dependencies.store The school's balances, payouts and payout details.
 * @param dependencies.clock The current time, for the hold and the next payout date.
 * @returns The payout operations.
 * @example
 * const payouts = createPayouts({ store: createPayoutStore(db, schoolId), clock });
 */
export function createPayouts({ store, clock }: { store: PayoutStore; clock: Clock }) {
  return {
    /**
     * Reads what the platform owes the school, with when and above what it is paid out.
     *
     * @returns The balance per currency, the next payout date and the minimums.
     */
    async getBalance(): Promise<{ balances: CurrencyBalance[]; nextPayoutDate: Date; minimums: Record<Currency, number> }> {
      const now = clock.now();
      return { balances: await store.balances(payableBefore(now)), nextPayoutDate: nextPayoutDate(now), minimums: PAYOUT_MINIMUMS };
    },

    /**
     * Reads where the school's payouts are sent.
     *
     * @returns The payout details, or null before the owner saves them.
     */
    getAccount(): Promise<PayoutAccount | null> {
      return store.findPayoutAccount();
    },

    /**
     * Saves where the school's payouts are sent.
     *
     * @param account The holder, bank and account.
     * @returns The saved details.
     */
    saveAccount(account: PayoutAccount): Promise<PayoutAccount> {
      return store.savePayoutAccount(account);
    },

    /**
     * Lists the payouts made to the school.
     *
     * @returns The payouts, newest first.
     */
    listPayouts(): Promise<Payout[]> {
      return store.listPayouts();
    },
  };
}

/** A payout a platform admin should make: one school's available balance in one currency, with where to send it. */
export interface DuePayout {
  school: SchoolBalances["school"];
  account: PayoutAccount | null;
  currency: Currency;
  amount: number;
}

/**
 * Builds the payout use cases for platform admins, across schools: the payouts due, and recording the
 * transfers made.
 *
 * @param dependencies Every school's balances and the clock.
 * @param dependencies.store Every school's balances and payouts.
 * @param dependencies.clock The current time, for the hold.
 * @returns The admin payout operations.
 * @example
 * const admin = createPayoutAdmin({ store: createPayoutAdminStore(db), clock });
 */
export function createPayoutAdmin({ store, clock }: { store: PayoutAdminStore; clock: Clock }) {
  return {
    /**
     * Lists the payouts due: each school's available balance in each currency that reaches the minimum.
     *
     * @returns The payouts, largest first within each currency.
     */
    async listDuePayouts(): Promise<DuePayout[]> {
      const schools = await store.listBalances(payableBefore(clock.now()));
      return schools
        .flatMap(({ school, account, balances }) =>
          balances.filter(({ currency, available }) => available >= PAYOUT_MINIMUMS[currency]).map(({ currency, available }) => ({ school, account, currency, amount: available })),
        )
        .sort((a, b) => a.currency.localeCompare(b.currency) || b.amount - a.amount);
    },

    /**
     * Records a transfer made to a school.
     *
     * @param payout The school, currency, amount, date and reference.
     * @param adminId The platform admin recording it.
     * @returns The payout.
     * @throws {PayoutExceedsBalanceError} When it is more than the school's available balance, or no school has the id.
     */
    async recordPayout(payout: RecordPayoutInput, adminId: string): Promise<Payout> {
      const recorded = await store.recordPayout(payout, payableBefore(clock.now()), adminId);
      if (!recorded) throw new PayoutExceedsBalanceError();
      return recorded;
    },
  };
}

/** One school's payout use cases. */
export type Payouts = ReturnType<typeof createPayouts>;

/** The platform admins' payout use cases. */
export type PayoutAdmin = ReturnType<typeof createPayoutAdmin>;
