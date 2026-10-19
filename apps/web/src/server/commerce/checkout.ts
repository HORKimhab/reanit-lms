import type { OrderSummary, PaymentMethod, PriceInput } from "@reanit/core/commerce";

import { getApi } from "../api";
import { checkPublicResponse } from "../schools/site";
import { checkStudentResponse } from "../schools/student";

/** How a course can be bought: its price (null when not for sale) and the methods that take its currency. */
export type Offer = { price: PriceInput | null; methods: PaymentMethod[] };

/** An order as its buyer sees it; the gateway's reference stays on the server. */
export type Order = Omit<OrderSummary, "providerRef">;

/**
 * Loads how a published course can be bought.
 *
 * @param subdomain The school's subdomain.
 * @param slug The course's slug.
 * @returns The price and payment methods.
 * @throws {Error} Next's not-found signal for an unknown school or course, or an unexpected-response error.
 */
export async function getOffer(subdomain: string, slug: string): Promise<Offer> {
  const { data, response } = await (await getApi()).GET("/schools/by-subdomain/{subdomain}/courses/{slug}/offer", {
    params: { path: { subdomain, slug } },
  });
  checkPublicResponse(response);
  // checkPublicResponse returned, so the API answered 2xx with the offer.
  return data!;
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
 * Builds the path under which each order has its status page (`<path>/<order id>`), the success URL the API gives gateways.
 *
 * @param subdomain The school's subdomain.
 * @returns The path.
 */
export function ordersPath(subdomain: string): string {
  return `/s/${subdomain}/orders`;
}
