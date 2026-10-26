import type { DbClient } from "./client";
import { appendEvent } from "./outbox";
import { PRICE_FIELDS, PRODUCT_FIELDS, productOf, toBilling } from "./prices";
import { forSchool, inSchoolTransaction } from "./tenant";

/** Most subscriptions one sweep step handles; the next sweep picks up the rest. */
const SWEEP_BATCH = 500;

/** A subscription a sweep step picked, with the period end it is about. */
type Candidate = { id: string; schoolId: string; currentPeriodEnd: Date };

/** Which notice a sweep step sends, and the column that says it was sent for a period. */
type Notice = { marker: "renewalNoticeFor" | "lastDayNoticeFor"; isLastDay: boolean };

/**
 * Lists active subscriptions whose period ended at or before a cutoff, across schools, optionally only
 * those whose current period has not had a notice yet.
 *
 * @param db Unscoped client.
 * @param periodEndBefore The cutoff.
 * @param unnoticedBy The column recording a notice, to leave out subscriptions it was sent for in this period.
 * @returns Up to `SWEEP_BATCH` of them, oldest period end first.
 */
async function activeEndingBy(db: DbClient, periodEndBefore: Date, unnoticedBy?: Notice["marker"]): Promise<Candidate[]> {
  const unnoticed = unnoticedBy && { OR: [{ [unnoticedBy]: null }, { [unnoticedBy]: { not: db.subscription.fields.currentPeriodEnd } }] };
  const rows = await db.subscription.findMany({
    where: { status: "active", currentPeriodEnd: { lte: periodEndBefore }, ...unnoticed },
    orderBy: { currentPeriodEnd: "asc" },
    take: SWEEP_BATCH,
    select: { id: true, schoolId: true, currentPeriodEnd: true },
  });
  // The query kept only subscriptions with a period end.
  return rows.map((row) => ({ ...row, currentPeriodEnd: row.currentPeriodEnd! }));
}

/**
 * Active subscriptions across schools, for the worker's renewal sweep: like the outbox relay it is
 * one cross-tenant job, so it finds subscriptions with the unscoped client, then changes each in its
 * school's transaction, together with the event that sends its email. A subscription changed meanwhile
 * (renewed, already noticed) is left alone. It satisfies `RenewalSweepStore` from `@reanit/core/commerce`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @returns The store operations.
 * @example
 * await createRenewalSweep({ store: createRenewalSweepStore(db), clock }).sweep();
 */
export function createRenewalSweepStore(db: DbClient) {
  /**
   * Marks a notice sent for each subscription's current period and records `SubscriptionRenewalDue`, once per period.
   *
   * @param candidates The subscriptions.
   * @param notice Which notice.
   * @param notice.marker The column that records it.
   * @param notice.isLastDay Whether it is the grace period's last day.
   * @returns How many got it.
   */
  async function sendNotice(candidates: Candidate[], { marker, isLastDay }: Notice) {
    let sent = 0;
    for (const { id, schoolId, currentPeriodEnd } of candidates) {
      const isSent = await inSchoolTransaction(db, schoolId, async (tx) => {
        const { count } = await tx.subscription.updateMany({
          where: { id, status: "active", currentPeriodEnd, OR: [{ [marker]: null }, { [marker]: { not: currentPeriodEnd } }] },
          data: { [marker]: currentPeriodEnd },
        });
        if (count === 0) return false;
        await appendEvent(tx, { type: "SubscriptionRenewalDue", schoolId, payload: { subscriptionId: id, periodEnd: currentPeriodEnd.toISOString(), isLastDay } });
        return true;
      });
      if (isSent) sent += 1;
    }
    return sent;
  }

  return {
    /**
     * Lapses active subscriptions whose grace period passed unpaid and records `SubscriptionLapsed`.
     * Their access already ended: their enrollments expired with the grace period.
     *
     * @param periodEndBefore Subscriptions whose period ended at or before this lapse.
     * @returns How many lapsed.
     */
    async lapseSubscriptions(periodEndBefore: Date) {
      let lapsed = 0;
      for (const { id, schoolId } of await activeEndingBy(db, periodEndBefore)) {
        const isLapsed = await inSchoolTransaction(db, schoolId, async (tx) => {
          const { count } = await tx.subscription.updateMany({ where: { id, status: "active", currentPeriodEnd: { lte: periodEndBefore } }, data: { status: "lapsed" } });
          if (count === 0) return false;
          const { userId, price } = await tx.subscription.findUniqueOrThrow({ where: { id }, select: { userId: true, price: { select: PRODUCT_FIELDS } } });
          await appendEvent(tx, { type: "SubscriptionLapsed", schoolId, payload: { subscriptionId: id, userId, courseIds: productOf(price).courseIds } });
          return true;
        });
        if (isLapsed) lapsed += 1;
      }
      return lapsed;
    },

    /**
     * Records that active subscriptions ending soon are due for renewal, once per period.
     *
     * @param periodEndBefore Subscriptions whose period ends at or before this are due.
     * @returns How many were noticed.
     */
    async noticeRenewals(periodEndBefore: Date) {
      return sendNotice(await activeEndingBy(db, periodEndBefore, "renewalNoticeFor"), { marker: "renewalNoticeFor", isLastDay: false });
    },

    /**
     * Records that active subscriptions are on their grace period's last day, once per period.
     *
     * @param periodEndBefore Subscriptions whose period ended at or before this are on their last day.
     * @returns How many were reminded.
     */
    async noticeLastGraceDays(periodEndBefore: Date) {
      return sendNotice(await activeEndingBy(db, periodEndBefore, "lastDayNoticeFor"), { marker: "lastDayNoticeFor", isLastDay: true });
    },
  };
}

/**
 * One school's subscriptions as their renewal emails describe them, through the tenant client. It
 * satisfies `RenewalNoticeStore` from `@reanit/core/notifications`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @param schoolId The school.
 * @returns The store operations.
 * @throws {z.ZodError} When `schoolId` is not a UUID.
 * @example
 * const renewals = createRenewalEmails({ renewalsFor: (schoolId) => createRenewalNoticeStore(db, schoolId), mailer, composer, appUrl });
 */
export function createRenewalNoticeStore(db: DbClient, schoolId: string) {
  const tenant = forSchool(db, schoolId);

  return {
    /**
     * Reads a subscription with its student, school, price and the language of its last order.
     *
     * @param subscriptionId The subscription.
     * @returns The notice, or null when the school has no such subscription or it was never paid.
     */
    async findRenewalNotice(subscriptionId: string) {
      const row = await tenant.subscription.findFirst({
        where: { id: subscriptionId },
        select: {
          status: true,
          paidPeriods: true,
          currentPeriodEnd: true,
          user: { select: { email: true, name: true } },
          school: { select: { name: true, subdomain: true } },
          price: { select: { ...PRICE_FIELDS, ...PRODUCT_FIELDS } },
          orders: { orderBy: { createdAt: "desc" }, take: 1, select: { locale: true } },
        },
      });
      if (!row?.currentPeriodEnd) return null;
      const billing = toBilling(row.price);
      // Subscriptions are only made for recurring and payment plan prices.
      if (billing.kind === "one_time") return null;
      return {
        locale: (row.orders[0]?.locale ?? "en") as "en" | "km",
        student: row.user,
        school: row.school,
        title: productOf(row.price).title,
        price: { amount: row.price.amount, currency: row.price.currency as "USD" | "KHR" },
        billing,
        paidPeriods: row.paidPeriods,
        status: row.status,
        currentPeriodEnd: row.currentPeriodEnd,
      };
    },
  };
}
