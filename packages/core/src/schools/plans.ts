import type { Clock } from "../auth";
import { minorStep, type BillingInterval, type Currency } from "../commerce/rules";
import { SUBSCRIPTION_GRACE_DAYS } from "../commerce/subscriptions";
import { PlanLimitError } from "./errors";

/** The plans a school can be on, cheapest first. */
export const CREATOR_PLANS = ["free", "pro", "business"] as const;

/** A school's plan. */
export type CreatorPlan = (typeof CREATOR_PLANS)[number];

/** Plans a creator pays for. */
export const PAID_PLANS = ["pro", "business"] as const;

/** A plan a creator pays for. */
export type PaidPlan = (typeof PAID_PLANS)[number];

/** What a plan allows; null means no limit. */
export interface PlanLimits {
  /** Courses published at once. */
  publishedCourses: number | null;
  /** Team members besides the owner, invites waiting for an answer included. */
  teamMembers: number | null;
  customDomain: boolean;
  /** Students can pay subscriptions and plans with the school's own payment QR. */
  offlineQr: boolean;
}

/** What a plan costs the creator and what it allows. */
export interface PlanTerms {
  /** USD cents a month and a year; null for the free plan. */
  prices: Record<BillingInterval, number> | null;
  /** The platform's fee on each sale, in hundredths of a percent. */
  feeBasisPoints: number;
  limits: PlanLimits;
}

/** Plans are priced in US dollars. */
export const PLAN_CURRENCY: Currency = "USD";

/** Each plan's price, fee and limits. A year costs ten months. */
export const PLAN_TERMS: Record<CreatorPlan, PlanTerms> = {
  free: { prices: null, feeBasisPoints: 1000, limits: { publishedCourses: 3, teamMembers: 0, customDomain: false, offlineQr: false } },
  pro: { prices: { month: 2900, year: 29_000 }, feeBasisPoints: 500, limits: { publishedCourses: null, teamMembers: 3, customDomain: true, offlineQr: true } },
  business: { prices: { month: 9900, year: 99_000 }, feeBasisPoints: 200, limits: { publishedCourses: null, teamMembers: null, customDomain: true, offlineQr: true } },
};

const BASIS_POINTS = 10_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A school's plan as stored: what it last paid for, and until when. */
export interface StoredPlan {
  plan: CreatorPlan;
  /** The paid plan's period; null on the free plan. */
  interval: BillingInterval | null;
  /** The end of the paid period; null on the free plan. */
  periodEnd: Date | null;
}

/**
 * Tells which plan a school is on now: a paid plan holds until a week past its paid period, then the
 * school is back on Free (nothing it has is removed; it just cannot add past Free's limits).
 *
 * @param stored The plan as stored.
 * @param stored.plan The plan last paid for, or Free.
 * @param stored.periodEnd The end of its paid period.
 * @param now The current time.
 * @returns The plan in force.
 * @example
 * currentPlan({ plan: "pro", interval: "month", periodEnd: new Date("2026-11-01") }, new Date("2026-11-05")); // "pro"
 */
export function currentPlan({ plan, periodEnd }: StoredPlan, now: Date): CreatorPlan {
  if (plan === "free") return plan;
  return periodEnd && periodEnd.getTime() + SUBSCRIPTION_GRACE_DAYS * DAY_MS > now.getTime() ? plan : "free";
}

/**
 * Works out the platform's fee on a sale, rounded to what the currency can charge (whole riel).
 *
 * @param amount What the sale charged, in minor units.
 * @param currency Its currency.
 * @param plan The school's plan when it sold.
 * @returns The fee in minor units.
 * @example
 * platformFee(4900, "USD", "pro"); // 245
 */
export function platformFee(amount: number, currency: Currency, plan: CreatorPlan): number {
  const step = minorStep(currency);
  return Math.round((amount * PLAN_TERMS[plan].feeBasisPoints) / BASIS_POINTS / step) * step;
}

/** One school's plan as stored. `@reanit/db` implements it with `createSchoolPlanStore`. */
export interface SchoolPlanStore {
  findPlan(): Promise<StoredPlan>;
}

/**
 * Builds one school's plan guard: the plan in force, and checks that refuse an addition past its limits.
 *
 * @param dependencies The school's plan and the clock.
 * @param dependencies.store The school's stored plan.
 * @param dependencies.clock The current time, for a plan that ran out.
 * @returns The plan operations.
 * @example
 * const plan = createPlanGuard({ store: createSchoolPlanStore(db, schoolId), clock });
 * await plan.assertWithin("publishedCourses", publishedNow);
 */
export function createPlanGuard({ store, clock }: { store: SchoolPlanStore; clock: Clock }) {
  /**
   * Reads the plan in force.
   *
   * @returns The plan.
   */
  async function plan(): Promise<CreatorPlan> {
    return currentPlan(await store.findPlan(), clock.now());
  }

  return {
    plan,

    /**
     * Refuses one more of something counted when the plan's limit is reached.
     *
     * @param limit What is counted.
     * @param count How many the school has now.
     * @throws {PlanLimitError} When one more would pass the plan's limit.
     */
    async assertWithin(limit: "publishedCourses" | "teamMembers", count: number): Promise<void> {
      const allowed = PLAN_TERMS[await plan()].limits[limit];
      if (allowed !== null && count >= allowed) throw new PlanLimitError(limit);
    },

    /**
     * Refuses a feature the plan leaves out.
     *
     * @param feature The feature.
     * @throws {PlanLimitError} When the plan does not include it.
     */
    async assertAllows(feature: "customDomain" | "offlineQr"): Promise<void> {
      if (!PLAN_TERMS[await plan()].limits[feature]) throw new PlanLimitError(feature);
    },

    /**
     * Tells whether the plan includes a feature.
     *
     * @param feature The feature.
     * @returns Whether it does.
     */
    async allows(feature: "customDomain" | "offlineQr"): Promise<boolean> {
      return PLAN_TERMS[await plan()].limits[feature];
    },
  };
}

/** One school's plan guard. */
export type PlanGuard = ReturnType<typeof createPlanGuard>;
