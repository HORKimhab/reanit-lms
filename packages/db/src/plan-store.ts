import type { DbClient } from "./client";
import type { BillingInterval, CreatorPlan, PaymentMethod } from "./generated/prisma/client";
import { forSchool, inSchoolTransaction } from "./tenant";

/** A school's plan columns. */
const PLAN_FIELDS = { plan: true, planInterval: true, planPeriodEnd: true } as const;

/** A paid plan; matches `PaidPlan` in `@reanit/core/schools`. */
type PaidPlan = Exclude<CreatorPlan, "free">;

/** A plan payment's columns. */
const PAYMENT_FIELDS = { id: true, plan: true, interval: true, amount: true, method: true, status: true, providerRef: true, reference: true } as const;

/** How a confirmation finds a plan payment; matches `PlanPaymentMatch` in `@reanit/core/schools`. */
type PlanPaymentMatch = { method: Exclude<PaymentMethod, "offline_qr">; providerRef: string } | { offlinePaymentId: string };

/** One paid period's change; matches `RenewSubscription` in `@reanit/core/commerce`. */
type RenewSubscription = (
  terms: { billing: { kind: "recurring"; interval: BillingInterval }; paidPeriods: number; currentPeriodEnd: Date | null },
  paidAt: Date,
) => { currentPeriodEnd: Date };

/**
 * Reads one school's stored plan through its tenant client.
 *
 * @param db Unscoped client.
 * @param schoolId The school.
 * @returns The plan last paid for, its period and its end.
 */
async function findStoredPlan(db: DbClient, schoolId: string) {
  const school = await forSchool(db, schoolId).school.findUniqueOrThrow({ where: { id: schoolId }, select: PLAN_FIELDS });
  return { plan: school.plan, interval: school.planInterval, periodEnd: school.planPeriodEnd };
}

/**
 * One school's stored plan. It satisfies `SchoolPlanStore` from `@reanit/core/schools`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @param schoolId The school.
 * @returns The store operations.
 * @throws {z.ZodError} When `schoolId` is not a UUID.
 * @example
 * const plan = createPlanGuard({ store: createSchoolPlanStore(db, schoolId), clock });
 */
export function createSchoolPlanStore(db: DbClient, schoolId: string) {
  return {
    /**
     * Reads the school's plan.
     *
     * @returns The plan last paid for, its period and its end.
     * @throws {Error} When the school does not exist.
     */
    findPlan() {
      return findStoredPlan(db, schoolId);
    },
  };
}

/**
 * One school's plan and its payments to the platform, through the tenant client. It satisfies
 * `PlanBillingStore` from `@reanit/core/schools`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @param schoolId The school.
 * @returns The store operations.
 * @throws {z.ZodError} When `schoolId` is not a UUID.
 * @example
 * const billing = createPlanBilling({ store: createPlanBillingStore(db, schoolId), gateways, confirmPlanPayment, clock });
 */
export function createPlanBillingStore(db: DbClient, schoolId: string) {
  const tenant = forSchool(db, schoolId);

  return {
    /**
     * Reads the school's plan.
     *
     * @returns The plan last paid for, its period and its end.
     * @throws {Error} When the school does not exist.
     */
    findPlan() {
      return findStoredPlan(db, schoolId);
    },

    /**
     * Stores a pending payment for a plan period.
     *
     * @param payment The payment.
     * @param payment.plan Pro or Business.
     * @param payment.interval A month or a year.
     * @param payment.amount USD cents.
     * @param payment.method The gateway.
     * @returns Its id.
     */
    createPlanPayment({ plan, interval, amount, method }: { plan: PaidPlan; interval: BillingInterval; amount: number; method: PaymentMethod }) {
      return tenant.planPayment.create({ data: { schoolId, plan, interval, amount, method }, select: { id: true } });
    },

    /**
     * Records the gateway's reference for a payment, so its confirmation finds it.
     *
     * @param paymentId The payment.
     * @param providerRef The reference.
     */
    async setProviderRef(paymentId: string, providerRef: string) {
      await tenant.planPayment.updateMany({ where: { id: paymentId }, data: { providerRef } });
    },

    /**
     * Finds one of the school's plan payments.
     *
     * @param paymentId The payment.
     * @returns The payment, or null.
     */
    async findPlanPayment(paymentId: string) {
      const row = await tenant.planPayment.findFirst({ where: { id: paymentId }, select: PAYMENT_FIELDS });
      // Payments are only made for paid plans.
      return row && { ...row, plan: row.plan as PaidPlan };
    },

    /**
     * Marks a pending payment failed.
     *
     * @param paymentId The payment.
     */
    async failPlanPayment(paymentId: string) {
      await tenant.planPayment.updateMany({ where: { id: paymentId, status: "pending" }, data: { status: "failed" } });
    },

    /**
     * Records the creator's reference on a pending payment to the platform's QR, and when they gave it.
     *
     * @param paymentId The payment.
     * @param reference As the creator's banking app showed it.
     * @returns Whether the school had such a payment.
     */
    async submitOfflinePayment(paymentId: string, reference: string) {
      const { count } = await tenant.planPayment.updateMany({
        where: { id: paymentId, method: "offline_qr", status: "pending" },
        data: { reference, submittedAt: new Date() },
      });
      return count > 0;
    },
  };
}

/**
 * Confirms creators' plan payments across schools: finds the payment by the gateway's reference (which
 * is unique) or, for a payment to the platform's QR, by id, then marks it paid and moves the school's
 * plan on inside that school's transaction. It
 * satisfies `PlanConfirmationStore` from `@reanit/core/schools`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @returns The store operations.
 * @example
 * const confirmation = createPaymentConfirmation({ store: createPaymentConfirmationStore(db), plans: createPlanConfirmationStore(db), clock });
 */
export function createPlanConfirmationStore(db: DbClient) {
  return {
    /**
     * Marks a plan payment paid and moves the school's plan on, once. Paying the plan and period the
     * school is on continues from its paid period's end; any other plan starts at the payment.
     *
     * @param match The gateway and its reference, or the id of a payment to the platform's QR.
     * @param at When the payment was confirmed.
     * @param renew Computes the new period end.
     * @returns The payment and whether this call paid it, or null when no plan payment matches.
     */
    async confirm(match: PlanPaymentMatch, at: Date, renew: RenewSubscription) {
      const select = { id: true, schoolId: true, method: true, plan: true, interval: true } as const;
      const payment =
        "offlinePaymentId" in match
          ? await db.planPayment.findFirst({ where: { id: match.offlinePaymentId, method: "offline_qr" }, select })
          : await db.planPayment.findUnique({ where: { providerRef: match.providerRef }, select });
      if (!payment || ("method" in match && payment.method !== match.method)) return null;
      return inSchoolTransaction(db, payment.schoolId, async (tx) => {
        const { count } = await tx.planPayment.updateMany({ where: { id: payment.id, status: { in: ["pending", "failed"] } }, data: { status: "paid", paidAt: at } });
        if (count === 0) return { paymentId: payment.id, isNewlyPaid: false };
        // Touching the school first locks it, so two plan payments confirmed at once apply one after the other.
        const school = await tx.school.update({ where: { id: payment.schoolId }, data: { updatedAt: at }, select: PLAN_FIELDS });
        const isSamePlan = school.plan === payment.plan && school.planInterval === payment.interval;
        const { currentPeriodEnd } = renew(
          { billing: { kind: "recurring", interval: payment.interval }, paidPeriods: 0, currentPeriodEnd: isSamePlan ? school.planPeriodEnd : null },
          at,
        );
        await tx.school.update({ where: { id: payment.schoolId }, data: { plan: payment.plan, planInterval: payment.interval, planPeriodEnd: currentPeriodEnd } });
        return { paymentId: payment.id, isNewlyPaid: true };
      });
    },
  };
}
