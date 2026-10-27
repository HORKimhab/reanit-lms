import type { DbClient } from "./client";
import type { Prisma } from "./generated/prisma/client";
import type { Currency } from "./prices";
import { forSchool, inSchoolTransaction } from "./tenant";

/** What the platform owes a school in one currency; matches `CurrencyBalance` in `@reanit/core/commerce`. */
type CurrencyBalance = { currency: Currency; available: number; onHold: number };

/** A payout to record; matches `RecordPayoutInput` in `@reanit/core/commerce`. */
type NewPayout = { schoolId: string; currency: Currency; amount: number; paidAt: Date; reference: string };

/** Where a school's payouts are sent; matches `PayoutAccount` in `@reanit/core/commerce`. */
type PayoutAccount = { holderName: string; bankName: string; account: string };

/** A payout's columns. */
const PAYOUT_FIELDS = { id: true, currency: true, amount: true, paidAt: true, reference: true } as const;

/** Payout details' columns. */
const ACCOUNT_FIELDS = { holderName: true, bankName: true, account: true } as const;

/**
 * Orders whose money the platform still holds for the school: gateway sales that are paid, or that
 * staff refunded from the school's own money. A refund through the gateway gave the money back, so it no longer counts.
 */
const GATEWAY_SALES = { paymentMethod: { not: "offline_qr" }, OR: [{ status: "paid" }, { status: "refunded", isRefundedByHand: true }] } satisfies Prisma.OrderWhereInput;

/** The school's own QR sales: the money went straight to the school, which owes the platform its fee. */
const OWN_QR_SALES = { paymentMethod: "offline_qr", status: { in: ["paid", "refunded"] } } satisfies Prisma.OrderWhereInput;

/**
 * Adds an amount to a school's balance in a currency, starting the balance at zero.
 *
 * @param balances The balances being summed, by school, then currency.
 * @param key The school and currency.
 * @param key.schoolId The school.
 * @param key.currency The currency.
 * @param change What to add to the available and held amounts.
 */
function add(balances: Map<string, Map<Currency, CurrencyBalance>>, { schoolId, currency }: { schoolId: string; currency: string }, change: Partial<Omit<CurrencyBalance, "currency">>) {
  const bySchool = balances.get(schoolId) ?? new Map<Currency, CurrencyBalance>();
  const balance = bySchool.get(currency as Currency) ?? { currency: currency as Currency, available: 0, onHold: 0 };
  bySchool.set(balance.currency, { ...balance, available: balance.available + (change.available ?? 0), onHold: balance.onHold + (change.onHold ?? 0) });
  balances.set(schoolId, bySchool);
}

/**
 * Sums schools' balances from their orders and payouts: gateway sales less the platform's fee (available
 * once past their hold, held before), less the fees on the schools' own QR sales, less what was paid out.
 *
 * @param client A school's transaction, or the unscoped client for every school.
 * @param payableBefore Gateway sales paid at or before this are past their hold.
 * @returns The balances by school, then currency.
 */
async function sumBalances(client: Prisma.TransactionClient, payableBefore: Date) {
  const [available, held, ownQrFees, paidOut] = await Promise.all([
    client.order.groupBy({ by: ["schoolId", "currency"], where: { ...GATEWAY_SALES, paidAt: { lte: payableBefore } }, _sum: { totalAmount: true, platformFee: true } }),
    client.order.groupBy({ by: ["schoolId", "currency"], where: { ...GATEWAY_SALES, paidAt: { gt: payableBefore } }, _sum: { totalAmount: true, platformFee: true } }),
    client.order.groupBy({ by: ["schoolId", "currency"], where: OWN_QR_SALES, _sum: { platformFee: true } }),
    client.payout.groupBy({ by: ["schoolId", "currency"], _sum: { amount: true } }),
  ]);
  const balances = new Map<string, Map<Currency, CurrencyBalance>>();
  for (const row of available) add(balances, row, { available: (row._sum.totalAmount ?? 0) - (row._sum.platformFee ?? 0) });
  for (const row of held) add(balances, row, { onHold: (row._sum.totalAmount ?? 0) - (row._sum.platformFee ?? 0) });
  for (const row of ownQrFees) add(balances, row, { available: -(row._sum.platformFee ?? 0) });
  for (const row of paidOut) add(balances, row, { available: -(row._sum.amount ?? 0) });
  return balances;
}

/**
 * Lists one school's balances from the sums, by currency.
 *
 * @param balances The sums by school.
 * @param schoolId The school.
 * @returns Its balance in each currency it ever sold or was paid in, USD before KHR.
 */
function balancesOf(balances: Map<string, Map<Currency, CurrencyBalance>>, schoolId: string): CurrencyBalance[] {
  return [...(balances.get(schoolId)?.values() ?? [])].sort((a, b) => b.currency.localeCompare(a.currency));
}

/**
 * One school's balances, payouts and payout details, through the tenant client. It satisfies
 * `PayoutStore` from `@reanit/core/commerce`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @param schoolId The school.
 * @returns The store operations.
 * @throws {z.ZodError} When `schoolId` is not a UUID.
 * @example
 * const payouts = createPayouts({ store: createPayoutStore(db, schoolId), clock });
 */
export function createPayoutStore(db: DbClient, schoolId: string) {
  const tenant = forSchool(db, schoolId);

  return {
    /**
     * Sums the school's balance in each currency.
     *
     * @param payableBefore Gateway sales paid at or before this are past their hold.
     * @returns The balances, USD before KHR.
     */
    async balances(payableBefore: Date) {
      return balancesOf(await inSchoolTransaction(db, schoolId, (tx) => sumBalances(tx, payableBefore)), schoolId);
    },

    /**
     * Lists the payouts made to the school.
     *
     * @returns The payouts, newest first.
     */
    async listPayouts() {
      const rows = await tenant.payout.findMany({ orderBy: [{ paidAt: "desc" }, { id: "desc" }], select: PAYOUT_FIELDS });
      return rows.map((row) => ({ ...row, currency: row.currency as Currency }));
    },

    /**
     * Reads where the school's payouts are sent.
     *
     * @returns The payout details, or null before they are saved.
     */
    findPayoutAccount() {
      return tenant.payoutAccount.findFirst({ select: ACCOUNT_FIELDS });
    },

    /**
     * Saves where the school's payouts are sent, in place of the details it had.
     *
     * @param account The details.
     * @returns The saved details.
     */
    savePayoutAccount(account: PayoutAccount) {
      return tenant.payoutAccount.upsert({ where: { schoolId }, create: { schoolId, ...account }, update: account, select: ACCOUNT_FIELDS });
    },
  };
}

/**
 * Every school's balances and payouts, for platform admins: like the outbox relay it works across
 * schools, so it reads with the unscoped client and records each payout in its school's transaction. It
 * satisfies `PayoutAdminStore` from `@reanit/core/commerce`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @returns The store operations.
 * @example
 * const admin = createPayoutAdmin({ store: createPayoutAdminStore(db), clock });
 */
export function createPayoutAdminStore(db: DbClient) {
  return {
    /**
     * Lists every school with a balance, with its payout details.
     *
     * @param payableBefore Gateway sales paid at or before this are past their hold.
     * @returns The schools and their balances.
     */
    async listBalances(payableBefore: Date) {
      const balances = await sumBalances(db, payableBefore);
      const schools = await db.school.findMany({
        where: { id: { in: [...balances.keys()] } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, subdomain: true, payoutAccount: { select: ACCOUNT_FIELDS } },
      });
      return schools.map(({ payoutAccount, ...school }) => ({ school, account: payoutAccount, balances: balancesOf(balances, school.id) }));
    },

    /**
     * Records a payout unless it is more than the school's available balance, checked in the school's
     * transaction after locking the school, so two payouts recorded at once cannot both pass.
     *
     * @param payout The payout.
     * @param payableBefore Gateway sales paid at or before this are past their hold.
     * @param recordedById The platform admin recording it.
     * @returns The payout, or null when it is more than the balance or no school has the id.
     */
    async recordPayout(payout: NewPayout, payableBefore: Date, recordedById: string) {
      const { schoolId, currency, amount, paidAt, reference } = payout;
      if (!(await db.school.count({ where: { id: schoolId } }))) return null;
      return inSchoolTransaction(db, schoolId, async (tx) => {
        await tx.school.update({ where: { id: schoolId }, data: { updatedAt: new Date() } });
        const available = balancesOf(await sumBalances(tx, payableBefore), schoolId).find((balance) => balance.currency === currency)?.available ?? 0;
        if (amount > available) return null;
        const row = await tx.payout.create({ data: { schoolId, currency, amount, paidAt, reference, recordedById }, select: PAYOUT_FIELDS });
        return { ...row, currency: row.currency as Currency };
      });
    },
  };
}
