import type { DbClient } from "./client";
import { recordSale } from "./daily-stats";
import type { PaymentMethod } from "./generated/prisma/client";
import { forSchool, inSchoolTransaction } from "./tenant";

/** Prices are integer minor units with an ISO code; the store only knows these two currencies. */
type Currency = "USD" | "KHR";

const PRICE_FIELDS = { id: true, amount: true, currency: true } as const;
const NEWEST_FIRST = { createdAt: "desc" } as const;

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
     * Creates a pending order for one course, at the given price.
     *
     * @param order The order.
     * @param order.userId The buyer.
     * @param order.courseId The course.
     * @param order.price The price charged.
     * @param order.price.id Its id.
     * @param order.price.amount Amount in minor units.
     * @param order.price.currency ISO code.
     * @param order.method The payment method chosen.
     * @returns The order's id.
     */
    createOrder({
      userId,
      courseId,
      price,
      method,
    }: {
      userId: string;
      courseId: string;
      price: { id: string; amount: number; currency: Currency };
      method: PaymentMethod;
    }) {
      return inSchoolTransaction(db, schoolId, (tx) =>
        tx.order.create({
          data: {
            schoolId,
            userId,
            totalAmount: price.amount,
            currency: price.currency,
            paymentMethod: method,
            items: { create: { schoolId, courseId, priceId: price.id, amount: price.amount, currency: price.currency } },
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
     * Marks an order paid, enrolls its buyer and counts the sale in the daily stats, once. Concurrent
     * confirmations of the same order are safe: only the one that moves it out of `pending` enrolls.
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
        return { orderId: order.id, isNewlyPaid: true };
      });
    },
  };
}
