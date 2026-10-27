// Fakes of the plan ports, for unit tests of plan limits, fees and plan billing.
import type { RenewSubscription } from "../commerce";
import {
  createPlanGuard,
  type CreatorPlan,
  type PlanBillingStore,
  type PlanConfirmationStore,
  type PlanPayment,
  type PlanPaymentMatch,
  type PlatformAdminStore,
  type SchoolPlanStore,
  type SchoolSuspension,
  type StoredPlan,
  type StoredPlatformSchool,
} from "../schools";
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
  /** When each payment to the platform's QR was said to be paid, by payment id. */
  readonly submittedAt = new Map<string, Date>();

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
  async createPlanPayment(payment: Omit<PlanPayment, "id" | "status" | "providerRef" | "reference">) {
    const id = `plan-payment-${this.payments.length + 1}`;
    this.payments.push({ ...payment, id, status: "pending", providerRef: null, reference: null });
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

  /**
   * Records the creator's reference on a pending payment to the platform's QR.
   *
   * @param paymentId The payment.
   * @param reference The reference.
   * @returns Whether there was such a payment.
   */
  async submitOfflinePayment(paymentId: string, reference: string) {
    const payment = this.payments.find(({ id }) => id === paymentId);
    if (payment?.method !== "offline_qr" || payment.status !== "pending") return false;
    payment.reference = reference;
    this.submittedAt.set(paymentId, new Date("2026-10-27T09:00:00Z"));
    return true;
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
   * @param match The gateway and its reference, or the id of a payment to the platform's QR.
   * @param at When it was confirmed.
   * @param renew Applies the paid period.
   * @returns The payment and whether it was newly paid, or null.
   */
  async confirm(match: PlanPaymentMatch, at: Date, renew: RenewSubscription) {
    const payment = this.billing.payments.find((candidate) =>
      "offlinePaymentId" in match ? candidate.method === "offline_qr" && candidate.id === match.offlinePaymentId : candidate.method === match.method && candidate.providerRef === match.providerRef,
    );
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

/** In-memory `PlatformAdminStore` over schools tests set, with one school's plan payments in a `FakePlanBillingStore`. */
export class FakePlatformAdminStore implements PlatformAdminStore {
  /** The last search the store was asked for. */
  lastQuery: { search: string | null; limit: number; offset: number } | null = null;

  /**
   * Holds the schools and the plan payments of the first of them.
   *
   * @param schools Every school, newest first.
   * @param billing The first school's plan payments.
   */
  constructor(
    readonly schools: StoredPlatformSchool[],
    readonly billing = new FakePlanBillingStore(),
  ) {}

  /**
   * Lists the schools whose name, subdomain or owner's email contains the search.
   *
   * @param query The search and window.
   * @param query.search Text to find, or null for every school.
   * @param query.limit Schools to return.
   * @param query.offset Schools to skip.
   * @returns The window's schools and how many match.
   */
  async listSchools(query: { search: string | null; limit: number; offset: number }) {
    this.lastQuery = query;
    const { search, limit, offset } = query;
    const matching = this.schools.filter((school) => !search || [school.name, school.subdomain, school.ownerEmail ?? ""].some((text) => text.includes(search)));
    return { schools: matching.slice(offset, offset + limit), total: matching.length };
  }

  /**
   * Sets a school's suspension.
   *
   * @param schoolId The school.
   * @param suspension The suspension, or null.
   * @returns Whether the school exists.
   */
  async setSuspension(schoolId: string, suspension: SchoolSuspension | null) {
    const school = this.schools.find(({ id }) => id === schoolId);
    if (!school) return false;
    school.suspension = suspension;
    return true;
  }

  /**
   * Lists the first school's pending payments to the platform's QR that have a reference.
   *
   * @returns The payments.
   */
  async listSubmittedPlanPayments() {
    const { id, name, subdomain } = this.schools[0]!;
    return this.billing.payments.flatMap((payment) =>
      payment.method === "offline_qr" && payment.status === "pending" && payment.reference
        ? [{ id: payment.id, school: { id, name, subdomain }, plan: payment.plan, interval: payment.interval, amount: payment.amount, reference: payment.reference, submittedAt: this.billing.submittedAt.get(payment.id)! }]
        : [],
    );
  }

  /**
   * Finds one of the first school's plan payments.
   *
   * @param paymentId The payment.
   * @returns Its school, method and status, or null.
   */
  async findPlanPayment(paymentId: string) {
    const payment = await this.billing.findPlanPayment(paymentId);
    return payment && { schoolId: this.schools[0]!.id, method: payment.method, status: payment.status };
  }

  /**
   * Fails a pending payment.
   *
   * @param paymentId The payment.
   * @returns Whether it was pending.
   */
  async failPlanPayment(paymentId: string) {
    const wasPending = (await this.billing.findPlanPayment(paymentId))?.status === "pending";
    await this.billing.failPlanPayment(paymentId);
    return wasPending;
  }
}
