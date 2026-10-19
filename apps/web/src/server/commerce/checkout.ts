import type { Discount, OrderSummary, PaymentMethod, PriceInput } from "@reanit/core/commerce";

import { getApi } from "../api";
import { checkPublicResponse } from "../schools/site";
import { checkStudentResponse } from "../schools/student";

/** How a course or bundle can be bought: its price (null when not for sale) and the methods that take its currency. */
export type Offer = { price: PriceInput | null; methods: PaymentMethod[] };

/** What a school sells: a course, or a bundle of courses. */
export type ProductKind = "course" | "bundle";

/** An order as its buyer sees it; the gateway's reference stays on the server. */
export type Order = Omit<OrderSummary, "providerRef">;

/**
 * Asks the API how a published course or bundle can be bought, priced with a coupon when one is given.
 *
 * @param subdomain The school's subdomain.
 * @param slug The course's or bundle's slug.
 * @param kind Whether it is a course or a bundle.
 * @param coupon The coupon code, upper case.
 * @returns The typed client's answer.
 */
async function fetchOffer(subdomain: string, slug: string, kind: ProductKind, coupon?: string) {
  const api = await getApi();
  const params = { path: { subdomain, slug }, query: coupon ? { coupon } : {} };
  return kind === "course"
    ? api.GET("/schools/by-subdomain/{subdomain}/courses/{slug}/offer", { params })
    : api.GET("/schools/by-subdomain/{subdomain}/bundles/{slug}/offer", { params });
}

/**
 * Loads how a published course or bundle can be bought.
 *
 * @param subdomain The school's subdomain.
 * @param slug The course's or bundle's slug.
 * @param kind Whether it is a course or a bundle.
 * @returns The price and payment methods.
 * @throws {Error} Next's not-found signal for an unknown school, course or bundle, or an unexpected-response error.
 */
export async function getOffer(subdomain: string, slug: string, kind: ProductKind = "course"): Promise<Offer> {
  const { data, response } = await fetchOffer(subdomain, slug, kind);
  checkPublicResponse(response);
  // checkPublicResponse returned, so the API answered 2xx with the offer.
  const { price, methods } = data!;
  return { price, methods };
}

/**
 * Prices a published course or bundle with a coupon.
 *
 * @param subdomain The school's subdomain.
 * @param slug The course's or bundle's slug.
 * @param coupon The coupon code, upper case.
 * @param kind Whether it is a course or a bundle.
 * @returns What the coupon takes off, or null when it cannot be used (unknown, expired, used up, another currency) or there is no price.
 * @throws {Error} Next's not-found signal for an unknown school, course or bundle, or an unexpected-response error.
 */
export async function getDiscount(subdomain: string, slug: string, coupon: string, kind: ProductKind = "course"): Promise<Discount | null> {
  const { data, response } = await fetchOffer(subdomain, slug, kind, coupon);
  if (response.status === 400) return null;
  checkPublicResponse(response);
  // checkPublicResponse returned, so the API answered 2xx with the offer.
  return data!.discount;
}

/**
 * Reads one of the signed-in buyer's orders; the API checks a pending PayWay or Bakong payment with the gateway.
 *
 * @param subdomain The school's subdomain.
 * @param orderId The order, from the URL.
 * @returns The order.
 * @throws {Error} Next's redirect signal when signed out, its not-found signal for someone else's or a malformed order, or an unexpected-response error.
 */
export async function getOrder(subdomain: string, orderId: string): Promise<Order> {
  const { data, response } = await (await getApi()).GET("/schools/by-subdomain/{subdomain}/orders/{orderId}", {
    params: { path: { subdomain, orderId } },
  });
  checkStudentResponse(response, `${ordersPath(subdomain)}/${orderId}`);
  // checkStudentResponse returned, so the API answered 2xx with the order.
  return data!.order;
}

/**
 * Builds the checkout page of a course or bundle.
 *
 * @param subdomain The school's subdomain.
 * @param kind Whether it is a course or a bundle.
 * @param slug The course's or bundle's slug.
 * @returns The path.
 */
export function checkoutPath(subdomain: string, kind: ProductKind, slug: string): string {
  return `/s/${subdomain}/${kind === "course" ? "checkout" : "bundle-checkout"}/${slug}`;
}

/**
 * Builds the path under which each order has its status page (`<path>/<order id>`), the success URL the API gives gateways.
 *
 * @param subdomain The school's subdomain.
 * @returns The path.
 */
export function ordersPath(subdomain: string): string {
  return `/s/${subdomain}/orders`;
}
