import type { DbClient } from "./client";
import type { Prisma } from "./generated/prisma/client";
import { forSchool } from "./tenant";

/** A listed school's columns, with its first owner's email. */
const SCHOOL_FIELDS = {
  id: true,
  name: true,
  subdomain: true,
  createdAt: true,
  plan: true,
  planInterval: true,
  planPeriodEnd: true,
  suspendedAt: true,
  suspensionReason: true,
  memberships: { where: { role: "owner" }, orderBy: { createdAt: "asc" }, take: 1, select: { user: { select: { email: true } } } },
} as const satisfies Prisma.SchoolSelect;

/** Paid plans; matches `PaidPlan` in `@reanit/core/schools`. */
type PaidPlan = "pro" | "business";

/**
 * Builds the filter for a school search: the text in the name, subdomain or an owner's email, ignoring case.
 *
 * @param search The text, or null for every school.
 * @returns The filter.
 */
function schoolSearch(search: string | null): Prisma.SchoolWhereInput {
  if (!search) return {};
  const contains = { contains: search, mode: "insensitive" } as const;
  return { OR: [{ name: contains }, { subdomain: contains }, { memberships: { some: { role: "owner", user: { email: contains } } } }] };
}

/**
 * Schools and plan payments across the platform, for its admins. Reads run before any tenant is known,
 * so they use the unscoped client; a plan payment's change goes through its school's tenant client. It
 * satisfies `PlatformAdminStore` from `@reanit/core/schools`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @returns The store operations.
 * @example
 * const admin = createPlatformAdmin({ store: createPlatformAdminStore(db), confirmOfflinePlan, clock });
 */
export function createPlatformAdminStore(db: DbClient) {
  return {
    /**
     * Lists one window of schools matching the search, newest first, with how many match.
     *
     * @param query The search and window.
     * @param query.search Text to find in the name, subdomain or owner's email; null for every school.
     * @param query.limit Schools to return.
     * @param query.offset Schools to skip.
     * @returns The schools and the number that match.
     */
    async listSchools({ search, limit, offset }: { search: string | null; limit: number; offset: number }) {
      const where = schoolSearch(search);
      const [rows, total] = await Promise.all([
        db.school.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: offset, take: limit, select: SCHOOL_FIELDS }),
        db.school.count({ where }),
      ]);
      const schools = rows.map(({ plan, planInterval, planPeriodEnd, suspendedAt, suspensionReason, memberships, ...school }) => ({
        ...school,
        ownerEmail: memberships[0]?.user.email ?? null,
        plan: { plan, interval: planInterval, periodEnd: planPeriodEnd },
        // The schools_suspension_check constraint sets both or neither.
        suspension: suspendedAt ? { at: suspendedAt, reason: suspensionReason! } : null,
      }));
      return { schools, total };
    },

    /**
     * Takes a school offline, or back online.
     *
     * @param schoolId The school.
     * @param suspension Why and since when, or null to bring it back.
     * @returns Whether a school has the id.
     */
    async setSuspension(schoolId: string, suspension: { at: Date; reason: string } | null) {
      const { count } = await db.school.updateMany({ where: { id: schoolId }, data: { suspendedAt: suspension?.at ?? null, suspensionReason: suspension?.reason ?? null } });
      return count > 0;
    },

    /**
     * Lists the pending payments to the platform's QR whose creator gave a reference, oldest first.
     *
     * @returns The payments with their schools.
     */
    async listSubmittedPlanPayments() {
      const rows = await db.planPayment.findMany({
        where: { method: "offline_qr", status: "pending", reference: { not: null } },
        orderBy: { submittedAt: "asc" },
        select: { id: true, plan: true, interval: true, amount: true, reference: true, submittedAt: true, school: { select: { id: true, name: true, subdomain: true } } },
      });
      // A reference is always given with its time, and payments are only made for paid plans.
      return rows.map((row) => ({ ...row, plan: row.plan as PaidPlan, reference: row.reference!, submittedAt: row.submittedAt! }));
    },

    /**
     * Finds any school's plan payment.
     *
     * @param paymentId The payment.
     * @returns Its school, method and status, or null.
     */
    findPlanPayment(paymentId: string) {
      return db.planPayment.findUnique({ where: { id: paymentId }, select: { schoolId: true, method: true, status: true } });
    },

    /**
     * Marks a pending plan payment failed, through its school's tenant client.
     *
     * @param paymentId The payment.
     * @returns Whether it was pending.
     */
    async failPlanPayment(paymentId: string) {
      const payment = await db.planPayment.findUnique({ where: { id: paymentId }, select: { schoolId: true } });
      if (!payment) return false;
      const { count } = await forSchool(db, payment.schoolId).planPayment.updateMany({ where: { id: paymentId, status: "pending" }, data: { status: "failed" } });
      return count > 0;
    },
  };
}
