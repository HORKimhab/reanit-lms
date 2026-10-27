import { z } from "zod";

import type { Clock } from "../auth";
import type { BillingInterval } from "../commerce/rules";
import { pageSchema, pageWindow } from "../shared/paging";
import { PlanPaymentClosedError, PlanPaymentNotFoundError, SchoolNotFoundError } from "./errors";
import { currentPlan, type CreatorPlan, type PaidPlan, type StoredPlan } from "./plans";

/** Schools shown per page of the platform admin console. */
export const PLATFORM_SCHOOLS_PAGE_SIZE = 50;

/** Longest school search. */
const SCHOOL_SEARCH_MAX_LENGTH = 100;

/** Longest reason a platform admin gives for suspending a school. */
export const SUSPENSION_REASON_MAX_LENGTH = 500;

/** `GET /admin/schools` query: text to find in a school's name, subdomain or owner's email, and a page. */
export const platformSchoolsQuerySchema = z.object({
  q: z.string().trim().max(SCHOOL_SEARCH_MAX_LENGTH).optional(),
  page: pageSchema,
});

/** `POST /admin/schools/:id/suspension` body: why the school is taken offline. */
export const suspendSchoolSchema = z.object({ reason: z.string().trim().min(1).max(SUSPENSION_REASON_MAX_LENGTH) });

/** Parsed schools list query. */
export type PlatformSchoolsQuery = z.infer<typeof platformSchoolsQuerySchema>;

/** Parsed suspension. */
export type SuspendSchoolInput = z.infer<typeof suspendSchoolSchema>;

/** Why and since when a school is offline. */
export interface SchoolSuspension {
  at: Date;
  reason: string;
}

/** A school as the platform's store holds it, for its admins. */
export interface StoredPlatformSchool {
  id: string;
  name: string;
  subdomain: string;
  createdAt: Date;
  /** The owner's email; null only if the owner's account is gone. */
  ownerEmail: string | null;
  plan: StoredPlan;
  suspension: SchoolSuspension | null;
}

/** A school as the platform's admins see it: the plan in force, and until when it is paid. */
export interface PlatformSchool extends Omit<StoredPlatformSchool, "plan"> {
  plan: CreatorPlan;
  /** The paid period's end; null on Free, including once a paid plan ran out. */
  paidUntil: Date | null;
}

/** One page of schools. */
export interface PlatformSchoolPage {
  schools: PlatformSchool[];
  /** Schools matching across all pages. */
  total: number;
  page: number;
  pageSize: number;
}

/** A creator's payment to the platform's QR they say they made, waiting for a platform admin to find it. */
export interface SubmittedPlanPayment {
  id: string;
  school: { id: string; name: string; subdomain: string };
  plan: PaidPlan;
  interval: BillingInterval;
  /** USD cents. */
  amount: number;
  reference: string;
  submittedAt: Date;
}

/** Schools and plan payments across the platform. `@reanit/db` implements it with `createPlatformAdminStore`. */
export interface PlatformAdminStore {
  /** One page of schools matching `search` in name, subdomain or owner's email (all when null), newest first, with the number that match. */
  listSchools(query: { search: string | null; limit: number; offset: number }): Promise<{ schools: StoredPlatformSchool[]; total: number }>;
  /** Takes a school offline, or back online with null; false when no school has the id. */
  setSuspension(schoolId: string, suspension: SchoolSuspension | null): Promise<boolean>;
  /** Pending payments to the platform's QR whose creator gave a reference, oldest first. */
  listSubmittedPlanPayments(): Promise<SubmittedPlanPayment[]>;
  /** Any school's plan payment, or null when none has the id. */
  findPlanPayment(paymentId: string): Promise<{ schoolId: string; method: string; status: string } | null>;
  /** Marks a pending plan payment failed; false when it was not pending. */
  failPlanPayment(paymentId: string): Promise<boolean>;
}

/**
 * Builds the platform admins' school and plan payment use cases: listing schools, taking one offline
 * and back, and confirming or rejecting payments made to the platform's QR.
 *
 * @param dependencies The store, the plan confirmation and the clock.
 * @param dependencies.store Schools and plan payments across the platform.
 * @param dependencies.confirmOfflinePlan Marks a payment to the platform's QR paid and moves its school's plan on, once.
 * @param dependencies.clock The current time.
 * @returns The operations.
 * @example
 * const admin = createPlatformAdmin({ store: createPlatformAdminStore(db), confirmOfflinePlan: confirmation.confirmOfflinePlan, clock });
 */
export function createPlatformAdmin({
  store,
  confirmOfflinePlan,
  clock,
}: {
  store: PlatformAdminStore;
  confirmOfflinePlan: (paymentId: string) => Promise<unknown>;
  clock: Clock;
}) {
  /**
   * Finds a payment to the platform's QR that is still waiting.
   *
   * @param paymentId The payment.
   * @returns Its school's id.
   * @throws {PlanPaymentNotFoundError} When no school has such a payment.
   * @throws {PlanPaymentClosedError} When it is not a pending payment to the platform's QR.
   */
  async function openPayment(paymentId: string): Promise<string> {
    const payment = await store.findPlanPayment(paymentId);
    if (!payment) throw new PlanPaymentNotFoundError();
    if (payment.method !== "offline_qr" || payment.status !== "pending") throw new PlanPaymentClosedError();
    return payment.schoolId;
  }

  /**
   * Takes a school offline or back online.
   *
   * @param schoolId The school.
   * @param suspension Why and since when, or null to bring it back.
   * @throws {SchoolNotFoundError} When no school has the id.
   */
  async function setSuspension(schoolId: string, suspension: SchoolSuspension | null): Promise<void> {
    if (!(await store.setSuspension(schoolId, suspension))) throw new SchoolNotFoundError();
  }

  return {
    /**
     * Lists one page of schools, newest first, optionally searched, each with the plan in force.
     *
     * @param query The search and page.
     * @param query.q Text to find in a school's name, subdomain or owner's email; blank lists every school.
     * @param query.page 1-based page; past the last page it is empty.
     * @returns The page's schools and how many match in total.
     */
    async listSchools({ q, page }: PlatformSchoolsQuery): Promise<PlatformSchoolPage> {
      const { schools, total } = await store.listSchools({ search: q || null, ...pageWindow(page, PLATFORM_SCHOOLS_PAGE_SIZE) });
      const now = clock.now();
      return {
        schools: schools.map(({ plan: stored, ...school }) => {
          const plan = currentPlan(stored, now);
          return { ...school, plan, paidUntil: plan === "free" ? null : stored.periodEnd };
        }),
        total,
        page,
        pageSize: PLATFORM_SCHOOLS_PAGE_SIZE,
      };
    },

    /**
     * Takes a school offline: its site, catalog, checkout and player stop answering; its staff keep the dashboard.
     *
     * @param schoolId The school.
     * @param input Why.
     * @param input.reason Shown to platform admins.
     * @returns The suspension.
     * @throws {SchoolNotFoundError} When no school has the id.
     */
    async suspendSchool(schoolId: string, { reason }: SuspendSchoolInput): Promise<SchoolSuspension> {
      const suspension = { at: clock.now(), reason };
      await setSuspension(schoolId, suspension);
      return suspension;
    },

    /**
     * Brings a suspended school back online.
     *
     * @param schoolId The school.
     * @throws {SchoolNotFoundError} When no school has the id.
     */
    async unsuspendSchool(schoolId: string): Promise<void> {
      await setSuspension(schoolId, null);
    },

    /**
     * Lists the payments to the platform's QR whose creators say they paid, oldest first.
     *
     * @returns The payments.
     */
    listPlanPayments(): Promise<SubmittedPlanPayment[]> {
      return store.listSubmittedPlanPayments();
    },

    /**
     * Confirms a payment to the platform's QR that arrived: it is paid and its school's plan moves on.
     *
     * @param paymentId The payment.
     * @returns Its school's id.
     * @throws {PlanPaymentNotFoundError} When no school has such a payment.
     * @throws {PlanPaymentClosedError} When it is not a pending payment to the platform's QR.
     */
    async confirmPlanPayment(paymentId: string): Promise<{ schoolId: string }> {
      const schoolId = await openPayment(paymentId);
      await confirmOfflinePlan(paymentId);
      return { schoolId };
    },

    /**
     * Rejects a payment to the platform's QR that never arrived: it fails and the plan stays as it is.
     *
     * @param paymentId The payment.
     * @returns Its school's id.
     * @throws {PlanPaymentNotFoundError} When no school has such a payment.
     * @throws {PlanPaymentClosedError} When it is not a pending payment to the platform's QR.
     */
    async rejectPlanPayment(paymentId: string): Promise<{ schoolId: string }> {
      const schoolId = await openPayment(paymentId);
      if (!(await store.failPlanPayment(paymentId))) throw new PlanPaymentClosedError();
      return { schoolId };
    },
  };
}

/** The platform admins' school and plan payment use cases. */
export type PlatformAdmin = ReturnType<typeof createPlatformAdmin>;
