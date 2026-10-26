import { z } from "zod";

import { pageSchema, pageWindow } from "../shared/paging";
import { OrderNotFoundError } from "./errors";
import type { OrderDetail, OrderFilter, OrderHistoryStore } from "./ports";
import { CURRENCIES, ORDER_STATUSES } from "./rules";

/** Characters of an order's id people quote: enough to find it, short enough to read out. */
const ORDER_REFERENCE_LENGTH = 8;

/**
 * Gives the short reference receipts and order lists show for an order.
 *
 * @param orderId The order's id.
 * @returns Its first characters, upper-cased.
 * @example
 * orderReference("6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a40"); // "6F1C1F3E"
 */
export function orderReference(orderId: string): string {
  return orderId.slice(0, ORDER_REFERENCE_LENGTH).toUpperCase();
}

/** Orders shown per page, for students and staff alike. */
export const ORDERS_PAGE_SIZE = 50;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A UTC day, `YYYY-MM-DD`. */
const daySchema = z.iso.date();

/** The student's own orders: a 1-based page. */
export const myOrdersQuerySchema = z.object({ page: pageSchema });

/** Staff's orders list: optional filters by status, course, currency and the UTC days the order was placed (both included), and a page. */
export const orderListQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  courseId: z.uuid().optional(),
  currency: z.enum(CURRENCIES).optional(),
  from: daySchema.optional(),
  to: daySchema.optional(),
  page: pageSchema,
});

/** Parsed student orders query. */
export type MyOrdersQuery = z.infer<typeof myOrdersQuerySchema>;

/** Parsed staff orders query. */
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;

/** One page of orders. */
export interface OrderPage {
  orders: OrderDetail[];
  /** Orders matching across all pages. */
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Turns the staff query's days into the store's filter: `to` covers its whole UTC day.
 *
 * @param query The parsed query.
 * @param query.status Only orders with this status.
 * @param query.courseId Only orders that sold this course.
 * @param query.currency Only orders in this currency.
 * @param query.from The first UTC day placed.
 * @param query.to The last UTC day placed, included.
 * @returns The filter, without the page.
 */
function filterOf({ status, courseId, currency, from, to }: OrderListQuery): OrderFilter {
  return {
    status,
    courseId,
    currency,
    placedFrom: from ? new Date(from) : undefined,
    placedBefore: to ? new Date(new Date(to).getTime() + DAY_MS) : undefined,
  };
}

/**
 * Builds one school's order history: a student's own orders and receipts, and staff's list of
 * every order with filters.
 *
 * @param store The school's orders.
 * @returns The order history operations.
 * @example
 * const history = createOrderHistory(createOrderHistoryStore(db, schoolId));
 * await history.listMyOrders(user.id, { page: 1 });
 */
export function createOrderHistory(store: OrderHistoryStore) {
  /**
   * Lists one page of the orders matching a filter.
   *
   * @param filter Which orders.
   * @param page The 1-based page; past the last page it is empty.
   * @returns The page.
   */
  async function listPage(filter: OrderFilter, page: number): Promise<OrderPage> {
    const { orders, total } = await store.listOrders(filter, pageWindow(page, ORDERS_PAGE_SIZE));
    return { orders, total, page, pageSize: ORDERS_PAGE_SIZE };
  }

  return {
    /**
     * Lists the student's own orders in the school, newest first: their purchases and receipts.
     *
     * @param userId The signed-in student.
     * @param query The page.
     * @param query.page 1-based page.
     * @returns The page of their orders.
     */
    listMyOrders(userId: string, { page }: MyOrdersQuery): Promise<OrderPage> {
      return listPage({ userId }, page);
    },

    /**
     * Lists the school's orders for staff, newest first, filtered.
     *
     * @param query Filters and page.
     * @returns The page of orders.
     */
    listOrders(query: OrderListQuery): Promise<OrderPage> {
      return listPage(filterOf(query), query.page);
    },

    /**
     * Reads one of the school's orders for staff, with its buyer and courses.
     *
     * @param orderId The order.
     * @returns The order.
     * @throws {OrderNotFoundError} When the school has no such order.
     */
    async getOrder(orderId: string): Promise<OrderDetail> {
      const order = await store.findOrder(orderId);
      if (!order) throw new OrderNotFoundError();
      return order;
    },
  };
}

/** One school's order history use cases. */
export type OrderHistory = ReturnType<typeof createOrderHistory>;
