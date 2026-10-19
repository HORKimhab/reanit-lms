import type { DbClient } from "./client";
import { recordSale } from "./daily-stats";
import { Prisma, type PaymentMethod } from "./generated/prisma/client";
import { appendEvent } from "./outbox";
import { forSchool, inSchoolTransaction } from "./tenant";

/** Prices are integer minor units with an ISO code; the store only knows these two currencies. */
type Currency = "USD" | "KHR";

const PRICE_FIELDS = { id: true, amount: true, currency: true } as const;
const NEWEST_FIRST = { createdAt: "desc" } as const;
/** Prisma's error code for a unique constraint violation. */
const UNIQUE_VIOLATION = "P2002";

/** A coupon as the creator set it up; matches `CouponInput` in `@reanit/core/commerce`. */
type CouponInput = { code: string; expiresAt: Date | null; maxRedemptions: number | null } & (
  | { kind: "percent"; percentOff: number }
  | { kind: "fixed"; amountOff: number; currency: Currency }
);

/** Coupon columns, with its paid orders counted. */
const COUPON_FIELDS = {
  id: true,
  code: true,
  kind: true,
  percentOff: true,
  amountOff: true,
  currency: true,
  expiresAt: true,
  maxRedemptions: true,
  _count: { select: { orders: { where: { status: "paid" } } } },
} as const;

/** A coupon row as `COUPON_FIELDS` selects it. */
type CouponRow = Prisma.CouponGetPayload<{ select: typeof COUPON_FIELDS }>;

/**
 * Turns a coupon row into the coupon checkout uses; the table's check constraint guarantees each
 * kind has its own fields, so the fallbacks never apply.
 *
 * @param row The stored coupon.
 * @returns The coupon with how many paid orders used it.
 */
function toCoupon(row: CouponRow) {
  const limits = { id: row.id, code: row.code, expiresAt: row.expiresAt, maxRedemptions: row.maxRedemptions, redemptions: row._count.orders };
  return row.kind === "percent"
    ? { ...limits, kind: "percent" as const, percentOff: row.percentOff ?? 0 }
    : { ...limits, kind: "fixed" as const, amountOff: row.amountOff ?? 0, currency: (row.currency ?? "USD") as Currency };
}

/**
 * Narrows a stored currency code to the ones courses are sold in.
 *
 * @param price A stored price.
 * @param price.id Its id.
 * @param price.amount Amount in minor units.
 * @param price.currency ISO code as stored.
 * @returns The same price, typed.
 */
function toPrice({ id, amount, currency }: { id: string; amount: number; currency: string }) {
  return { id, amount, currency: currency as Currency };
}

/**
 * One school's prices and orders. Every query goes through the tenant client, so another school's
 * rows are invisible; it satisfies `CommerceStore` from `@reanit/core/commerce`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @param schoolId The school whose catalog this is.
 * @returns The store operations.
 * @throws {z.ZodError} When `schoolId` is not a UUID.
 * @example
 * const commerce = createCommerceService({ store: createCommerceStore(db, school.id), gateways });
 */
export function createCommerceStore(db: DbClient, schoolId: string) {
  const tenant = forSchool(db, schoolId);

  return {
    /**
     * Loads a course with its current (newest) price.
     *
     * @param slug The course's slug.
     * @returns The course, or null when the school has none with that slug.
     */
    async findCourse(slug: string) {
      const course = await tenant.course.findUnique({
        where: { schoolId_slug: { schoolId, slug } },
        select: { id: true, title: true, status: true, prices: { orderBy: NEWEST_FIRST, take: 1, select: PRICE_FIELDS } },
      });
      if (!course) return null;
      const [price] = course.prices;
      return { id: course.id, title: course.title, isPublished: course.status === "published", price: price ? toPrice(price) : null };
    },

    /**
     * Gives a course a new price; older prices stay for the orders that used them.
     *
     * @param courseId The course.
     * @param price Amount in minor units and currency.
     * @param price.amount Amount in minor units.
     * @param price.currency ISO code.
     * @returns The new price, or null when the school has no such course.
     */
    async setPrice(courseId: string, { amount, currency }: { amount: number; currency: Currency }) {
      if (!(await tenant.course.findFirst({ where: { id: courseId }, select: { id: true } }))) return null;
      return toPrice(await tenant.price.create({ data: { schoolId, courseId, amount, currency }, select: PRICE_FIELDS }));
    },

    /**
     * Tells whether a user already has a course.
     *
     * @param userId The user.
     * @param courseId The course.
     * @returns True when enrolled.
     */
    async isEnrolled(userId: string, courseId: string) {
      return (await tenant.enrollment.count({ where: { userId, courseId } })) > 0;
    },

    /**
     * Creates a pending order for one course at the given price, charging `amount` (the price less any coupon).
     *
     * @param order The order.
     * @param order.userId The buyer.
     * @param order.courseId The course.
     * @param order.price The price charged.
     * @param order.price.id Its id.
     * @param order.price.amount Amount in minor units.
     * @param order.price.currency ISO code.
     * @param order.amount What the order charges, in minor units.
     * @param order.couponId The coupon used, or null.
     * @param order.method The payment method chosen.
     * @param order.locale The language the buyer checked out in.
     * @returns The order's id.
     */
    createOrder({
      userId,
      courseId,
      price,
      amount,
      couponId,
      method,
      locale,
    }: {
      userId: string;
      courseId: string;
      price: { id: string; amount: number; currency: Currency };
      amount: number;
      couponId: string | null;
      method: PaymentMethod;
      locale: string;
    }) {
      return inSchoolTransaction(db, schoolId, (tx) =>
        tx.order.create({
          data: {
            schoolId,
            userId,
            totalAmount: amount,
            currency: price.currency,
            paymentMethod: method,
            locale,
            couponId,
            // The item carries what was charged, so sales stats count the discounted amount.
            items: { create: { schoolId, courseId, priceId: price.id, amount, currency: price.currency } },
          },
          select: { id: true },
        }),
      );
    },

    /**
     * Records the gateway's reference for an order, so its confirmation finds it.
     *
     * @param orderId The order.
     * @param providerRef The gateway's reference.
     */
    async setProviderRef(orderId: string, providerRef: string) {
      await tenant.order.updateMany({ where: { id: orderId }, data: { providerRef } });
    },

    /**
     * Reads one of a user's orders.
     *
     * @param orderId The order.
     * @param userId The buyer.
     * @returns The order, or null when the user has no such order in this school.
     */
    async findOrder(orderId: string, userId: string) {
      const order = await tenant.order.findFirst({
        where: { id: orderId, userId },
        select: {
          id: true,
          status: true,
          totalAmount: true,
          currency: true,
          paymentMethod: true,
          providerRef: true,
          items: { select: { courseId: true }, take: 1 },
        },
      });
      const [item] = order?.items ?? [];
      if (!order || !item) return null;
      return {
        id: order.id,
        status: order.status,
        courseId: item.courseId,
        amount: order.totalAmount,
        currency: order.currency as Currency,
        method: order.paymentMethod,
        providerRef: order.providerRef,
      };
    },

    /**
     * Creates a coupon.
     *
     * @param coupon Its code (upper case), discount, expiry and usage limit.
     * @returns The coupon, or null when the school already has one with the code.
     */
    async createCoupon(coupon: CouponInput) {
      const discount =
        coupon.kind === "percent" ? { percentOff: coupon.percentOff } : { amountOff: coupon.amountOff, currency: coupon.currency };
      try {
        return toCoupon(
          await tenant.coupon.create({
            data: { schoolId, code: coupon.code, kind: coupon.kind, expiresAt: coupon.expiresAt, maxRedemptions: coupon.maxRedemptions, ...discount },
            select: COUPON_FIELDS,
          }),
        );
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) return null;
        throw error;
      }
    },

    /**
     * Lists the school's coupons with their paid orders counted.
     *
     * @returns The coupons, newest first.
     */
    async listCoupons() {
      return (await tenant.coupon.findMany({ orderBy: NEWEST_FIRST, select: COUPON_FIELDS })).map(toCoupon);
    },

    /**
     * Finds a coupon by its code.
     *
     * @param code The upper-case code.
     * @returns The coupon, or null when the school has none with the code.
     */
    async findCoupon(code: string) {
      const coupon = await tenant.coupon.findUnique({ where: { schoolId_code: { schoolId, code } }, select: COUPON_FIELDS });
      return coupon && toCoupon(coupon);
    },

    /**
     * Deletes a coupon; its orders keep their amounts and lose the link.
     *
     * @param couponId The coupon.
     * @returns False when the school has no such coupon.
     */
    async deleteCoupon(couponId: string) {
      return (await tenant.coupon.deleteMany({ where: { id: couponId } })).count > 0;
    },
  };
}

/**
 * Confirms payments across schools: finds the order by the gateway's reference (which is unique),
 * then marks it paid and enrolls its buyer inside that school's tenant transaction.
 * It satisfies `PaymentConfirmationStore` from `@reanit/core/commerce`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @returns The store operations.
 * @example
 * const confirmation = createPaymentConfirmation(createPaymentConfirmationStore(db));
 */
export function createPaymentConfirmationStore(db: DbClient) {
  return {
    /**
     * Marks an order paid, enrolls its buyer, counts the sale in the daily stats and records `OrderPaid`
     * in the outbox, once. Concurrent confirmations of the same order are safe: only the one that moves it out of `pending` enrolls.
     *
     * @param method The gateway that confirmed the payment.
     * @param providerRef The gateway's reference.
     * @returns The order and whether this call paid it, or null when no order of that gateway has the reference.
     */
    async confirm(method: PaymentMethod, providerRef: string) {
      const order = await db.order.findUnique({
        where: { providerRef },
        select: { id: true, schoolId: true, userId: true, paymentMethod: true },
      });
      if (!order || order.paymentMethod !== method) return null;
      return inSchoolTransaction(db, order.schoolId, async (tx) => {
        const paidAt = new Date();
        const { count } = await tx.order.updateMany({
          where: { id: order.id, status: "pending" },
          data: { status: "paid", paidAt },
        });
        if (count === 0) return { orderId: order.id, isNewlyPaid: false };
        const items = await tx.orderItem.findMany({ where: { orderId: order.id }, select: { courseId: true, amount: true, currency: true } });
        for (const { courseId, amount, currency } of items) {
          await tx.enrollment.upsert({
            where: { userId_courseId: { userId: order.userId, courseId } },
            create: { schoolId: order.schoolId, userId: order.userId, courseId, orderId: order.id, source: "purchase" },
            update: {},
          });
          await recordSale(tx, { schoolId: order.schoolId, courseId, amount, currency, at: paidAt });
        }
        await appendEvent(tx, {
          type: "OrderPaid",
          schoolId: order.schoolId,
          payload: { orderId: order.id, userId: order.userId, courseIds: items.map((item) => item.courseId) },
        });
        return { orderId: order.id, isNewlyPaid: true };
      });
    },
  };
}
