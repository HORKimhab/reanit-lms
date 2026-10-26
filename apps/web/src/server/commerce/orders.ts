import { myOrdersQuerySchema, orderListQuerySchema, type OrderDetail, type OrderListQuery, type OrderPage } from "@reanit/core/commerce";
import { notFound } from "next/navigation";

import { getApi } from "../api";
import { checkStaffResponse } from "../schools/staff";
import { checkStudentResponse } from "../schools/student";

/** An order as the API sends it, with ISO times. */
type OrderJson = Omit<OrderDetail, "createdAt" | "paidAt" | "refundedAt"> & { createdAt: string; paidAt: string | null; refundedAt: string | null };

/** The first page of every order, for an orders URL whose query makes no sense. */
const FIRST_PAGE: OrderListQuery = { page: 1 };

/**
 * Turns an order from the API into one with dates.
 *
 * @param order The order as JSON.
 * @returns The order with its times as dates.
 */
function toOrder(order: OrderJson): OrderDetail {
  return {
    ...order,
    createdAt: new Date(order.createdAt),
    paidAt: order.paidAt === null ? null : new Date(order.paidAt),
    refundedAt: order.refundedAt === null ? null : new Date(order.refundedAt),
  };
}

/**
 * Turns a page of orders from the API into one with dates.
 *
 * @param page The page as JSON.
 * @returns The page with its orders' times as dates.
 */
function toOrderPage(page: Omit<OrderPage, "orders"> & { orders: OrderJson[] }): OrderPage {
  return { ...page, orders: page.orders.map(toOrder) };
}

/**
 * Reads a page number from a student's purchases URL.
 *
 * @param query The page's search params.
 * @returns The 1-based page; the first for a malformed one.
 */
export function purchasesPageFrom(query: Record<string, string | string[] | undefined>): number {
  const parsed = myOrdersQuerySchema.safeParse(query);
  return parsed.success ? parsed.data.page : 1;
}

/**
 * Reads the dashboard orders list's filters and page from its URL query.
 *
 * @param query The page's search params.
 * @returns The parsed filters, or the first page of every order when the query is malformed.
 */
export function orderFiltersFrom(query: Record<string, string | string[] | undefined>): OrderListQuery {
  // Empty fields come from the filter form's "any" options; they filter nothing.
  const filled = Object.fromEntries(Object.entries(query).filter(([, value]) => value !== ""));
  const parsed = orderListQuerySchema.safeParse(filled);
  return parsed.success ? parsed.data : FIRST_PAGE;
}

/**
 * Loads one page of the signed-in student's own orders in a school.
 *
 * @param subdomain The school's subdomain.
 * @param page The 1-based page.
 * @param returnPath Where a signed-out student comes back to after logging in.
 * @returns The page of orders, newest first.
 * @throws {Error} Next's redirect signal when signed out, its not-found signal for an unknown school, or an unexpected-response error.
 */
export async function listMyOrders(subdomain: string, page: number, returnPath: string): Promise<OrderPage> {
  const { data, response } = await (await getApi()).GET("/schools/by-subdomain/{subdomain}/orders", {
    params: { path: { subdomain }, query: { page } },
  });
  checkStudentResponse(response, returnPath);
  // checkStudentResponse returned, so the API answered 2xx with the page.
  return toOrderPage(data!);
}

/**
 * Loads one page of the signed-in staff member's school's orders.
 *
 * @param query Filters and page.
 * @returns The page of orders, newest first.
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
export async function listSchoolOrders(query: OrderListQuery): Promise<OrderPage> {
  const { data, response } = await (await getApi()).GET("/orders", { params: { query } });
  checkStaffResponse(response);
  // checkStaffResponse returned, so the API answered 2xx with the page.
  return toOrderPage(data!);
}

/**
 * Loads one of the signed-in staff member's school's orders.
 *
 * @param orderId The order, from the URL.
 * @returns The order with its courses and buyer.
 * @throws {Error} Next's not-found signal for an order the school does not have, a redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
export async function getSchoolOrder(orderId: string): Promise<OrderDetail> {
  const { data, response } = await (await getApi()).GET("/orders/{id}", { params: { path: { id: orderId } } });
  // A malformed id is an order the school does not have.
  if (response.status === 400) notFound();
  checkStaffResponse(response);
  // checkStaffResponse returned, so the API answered 2xx with the order.
  return toOrder(data!.order);
}
