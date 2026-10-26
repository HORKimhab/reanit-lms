import type { DbClient } from "./client";
import type { OrderStatus, Prisma } from "./generated/prisma/client";
import { forSchool } from "./tenant";

/** Currencies courses are sold in; matches `Currency` in `@reanit/core/commerce`. */
type Currency = "USD" | "KHR";

/** Which orders to list; matches `OrderFilter` in `@reanit/core/commerce`. */
type OrderFilter = {
  userId?: string;
  status?: OrderStatus;
  courseId?: string;
  currency?: Currency;
  placedFrom?: Date;
  placedBefore?: Date;
};

/** An order's columns with its courses, bundle, coupon and buyer. */
const ORDER_FIELDS = {
  id: true,
  status: true,
  paymentMethod: true,
  totalAmount: true,
  currency: true,
  createdAt: true,
  paidAt: true,
  refundedAt: true,
  isRefundedByHand: true,
  coupon: { select: { code: true } },
  user: { select: { id: true, name: true, email: true } },
  items: { select: { courseId: true, amount: true, currency: true, course: { select: { title: true } }, bundle: { select: { title: true } } } },
} satisfies Prisma.OrderSelect;

/**
 * Shapes an order row as order history shows it.
 *
 * @param row The stored order.
 * @returns The order with its total, courses, bundle, coupon and buyer.
 */
function toOrderDetail(row: Prisma.OrderGetPayload<{ select: typeof ORDER_FIELDS }>) {
  return {
    id: row.id,
    status: row.status,
    method: row.paymentMethod,
    total: { amount: row.totalAmount, currency: row.currency as Currency },
    items: row.items.map(({ courseId, amount, currency, course }) => ({ courseId, title: course.title, amount, currency: currency as Currency })),
    bundleTitle: row.items.find(({ bundle }) => bundle)?.bundle?.title ?? null,
    couponCode: row.coupon?.code ?? null,
    buyer: row.user,
    createdAt: row.createdAt,
    paidAt: row.paidAt,
    refundedAt: row.refundedAt,
    isRefundedByHand: row.isRefundedByHand,
  };
}

/**
 * One school's orders for order history. Every query goes through the tenant client, so another
 * school's orders are invisible; it satisfies `OrderHistoryStore` from `@reanit/core/commerce`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @param schoolId The school.
 * @returns The store operations.
 * @throws {z.ZodError} When `schoolId` is not a UUID.
 * @example
 * const history = createOrderHistory(createOrderHistoryStore(db, schoolId));
 */
export function createOrderHistoryStore(db: DbClient, schoolId: string) {
  const tenant = forSchool(db, schoolId);

  return {
    /**
     * Lists one window of the orders matching the filter, newest first.
     *
     * @param filter Buyer, status, course, currency and when they were placed; each narrows the list.
     * @param filter.userId Only this buyer's orders.
     * @param filter.status Only orders with this status.
     * @param filter.courseId Only orders that sold this course.
     * @param filter.currency Only orders in this currency.
     * @param filter.placedFrom Only orders placed at or after this moment.
     * @param filter.placedBefore Only orders placed before this moment.
     * @param window The limit and offset.
     * @param window.limit Most orders returned.
     * @param window.offset Orders skipped.
     * @returns The orders and how many match in total.
     */
    async listOrders({ userId, status, courseId, currency, placedFrom, placedBefore }: OrderFilter, { limit, offset }: { limit: number; offset: number }) {
      const where: Prisma.OrderWhereInput = {
        userId,
        status,
        currency,
        ...(courseId && { items: { some: { courseId } } }),
        ...((placedFrom || placedBefore) && { createdAt: { gte: placedFrom, lt: placedBefore } }),
      };
      const [rows, total] = await Promise.all([
        tenant.order.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit, skip: offset, select: ORDER_FIELDS }),
        tenant.order.count({ where }),
      ]);
      return { orders: rows.map(toOrderDetail), total };
    },

    /**
     * Finds one of the school's orders.
     *
     * @param orderId The order.
     * @returns The order, or null when the school has no such order.
     */
    async findOrder(orderId: string) {
      const row = await tenant.order.findFirst({ where: { id: orderId }, select: ORDER_FIELDS });
      return row && toOrderDetail(row);
    },
  };
}
