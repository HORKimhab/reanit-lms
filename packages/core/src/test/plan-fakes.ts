// Fakes of the plan ports, for unit tests of plan limits, fees and plan billing.
import type { PaymentGateway, RenewSubscription } from "../commerce";
import { createPlanGuard, type CreatorPlan, type PlanBillingStore, type PlanConfirmationStore, type PlanPayment, type SchoolPlanStore, type StoredPlan } from "../schools";
import { FakeClock } from "./auth-fakes";

/** A paid period that lasts past every test's clock. */
const FAR_FUTURE = new Date("2100-01-01T00:00:00Z");

/** In-memory `SchoolPlanStore` holding one stored plan. */
class FakeSchoolPlanStore implements SchoolPlanStore {
  /**
   * Holds the plan.
   *
   * @param stored The school's stored plan.
   */
  constructor(public stored: StoredPlan) {}

  /**
   * Reads the stored plan.
   *
   * @returns `stored`.
   */
  async findPlan() {
    return this.stored;
  }
}

/**
 * Builds a plan guard for a school on a plan paid far into the future.
 *
 * @param plan The plan.
 * @returns The guard.
 */
export function planGuardOn(plan: CreatorPlan) {
  const stored: StoredPlan = plan === "free" ? { plan, interval: null, periodEnd: null } : { plan, interval: "month", periodEnd: FAR_FUTURE };
  return createPlanGuard({ store: new FakeSchoolPlanStore(stored), clock: new FakeClock(new Date("2026-10-27T00:00:00Z")) });
}

/** In-memory `PlanBillingStore` of one school, whose payments tests can inspect. */
export class FakePlanBillingStore implements PlanBillingStore {
  readonly payments: PlanPayment[] = [];

  /**
   * Holds the school's plan.
   *
   * @param stored The school's stored plan.
   */
  constructor(public stored: StoredPlan = { plan: "free", interval: null, periodEnd: null }) {}

  /**
   * Reads the stored plan.
   *
   * @returns `stored`.
   */
  async findPlan() {
    return this.stored;
  }

  /**
   * Stores a pending payment.
   *
   * @param payment The payment.
   * @returns Its id.
   */
  async createPlanPayment(payment: Omit<PlanPayment, "id" | "status" | "providerRef">) {
    const id = `plan-payment-${this.payments.length + 1}`;
    this.payments.push({ ...payment, id, status: "pending", providerRef: null });
    return { id };
  }

  /**
   * Records the gateway's reference.
   *
   * @param paymentId The payment.
   * @param providerRef The reference.
   */
  async setProviderRef(paymentId: string, providerRef: string) {
    const payment = this.payments.find(({ id }) => id === paymentId);
    if (payment) payment.providerRef = providerRef;
  }

  /**
   * Finds a payment.
   *
   * @param paymentId The payment.
   * @returns The payment, or null.
   */
  async findPlanPayment(paymentId: string) {
    return this.payments.find(({ id }) => id === paymentId) ?? null;
  }

  /**
   * Fails a pending payment.
   *
   * @param paymentId The payment.
   */
  async failPlanPayment(paymentId: string) {
    const payment = this.payments.find(({ id }) => id === paymentId);
    if (payment?.status === "pending") payment.status = "failed";
  }
}

/** `PlanConfirmationStore` over a `FakePlanBillingStore`: confirms its payments and moves its plan on, as the real one does. */
export class FakePlanConfirmationStore implements PlanConfirmationStore {
  /**
   * Wraps the school whose payments it confirms.
   *
   * @param billing The school's fake billing store.
   */
  constructor(private readonly billing: FakePlanBillingStore = new FakePlanBillingStore()) {}

  /**
   * Marks the matching payment paid and moves the plan on, once.
   *
   * @param payment The gateway and its reference.
   * @param payment.method The gateway.
   * @param payment.providerRef Its reference.
   * @param at When it was confirmed.
   * @param renew Applies the paid period.
   * @returns The payment and whether it was newly paid, or null.
   */
  async confirm({ method, providerRef }: { method: PaymentGateway["method"]; providerRef: string }, at: Date, renew: RenewSubscription) {
    const payment = this.billing.payments.find((candidate) => candidate.method === method && candidate.providerRef === providerRef);
    if (!payment) return null;
    if (payment.status === "paid") return { paymentId: payment.id, isNewlyPaid: false };
    payment.status = "paid";
    const { stored } = this.billing;
    const isSamePlan = stored.plan === payment.plan && stored.interval === payment.interval;
    const change = renew({ billing: { kind: "recurring", interval: payment.interval }, paidPeriods: 0, currentPeriodEnd: isSamePlan ? stored.periodEnd : null }, at);
    this.billing.stored = { plan: payment.plan, interval: payment.interval, periodEnd: change.currentPeriodEnd };
    return { paymentId: payment.id, isNewlyPaid: true };
  }
}
