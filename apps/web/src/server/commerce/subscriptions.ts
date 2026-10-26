import type { PaymentMethod, PriceInput } from "@reanit/core/commerce";
import { notFound } from "next/navigation";

import { getApi } from "../api";
import { checkStudentResponse } from "../schools/student";

/** A student's subscription or payment plan as their purchases show it. */
export interface MySubscription {
  id: string;
  status: "active" | "completed" | "lapsed";
  title: string;
  price: PriceInput;
  /** How its next payment can be made, the default first. */
  methods: PaymentMethod[];
  paidPeriods: number;
  /** The end of the last paid period. */
  currentPeriodEnd: Date;
}

/**
 * Builds the page where a student pays a subscription's next period.
 *
 * @param subdomain The school's subdomain.
 * @param subscriptionId The subscription.
 * @returns The path.
 */
export function renewPath(subdomain: string, subscriptionId: string): string {
  return `/s/${subdomain}/renew/${subscriptionId}`;
}

/**
 * Loads the signed-in student's subscriptions and payment plans in a school.
 *
 * @param subdomain The school's subdomain.
 * @param returnPath Where a signed-out student comes back to after logging in.
 * @returns Every subscription they ever paid, newest first, with dates.
 * @throws {Error} Next's redirect signal when signed out, its not-found signal for an unknown school, or an unexpected-response error.
 */
export async function listMySubscriptions(subdomain: string, returnPath: string): Promise<MySubscription[]> {
  const { data, response } = await (await getApi()).GET("/schools/by-subdomain/{subdomain}/subscriptions", { params: { path: { subdomain } } });
  checkStudentResponse(response, returnPath);
  // checkStudentResponse returned, so the API answered 2xx with the subscriptions.
  return data!.subscriptions.map((subscription) => ({ ...subscription, currentPeriodEnd: new Date(subscription.currentPeriodEnd) }));
}

/**
 * Loads one of the signed-in student's subscriptions, for paying its next period.
 *
 * @param subdomain The school's subdomain.
 * @param subscriptionId The subscription, from the URL.
 * @returns The subscription.
 * @throws {Error} Next's not-found signal when the student has no such subscription, a redirect signal when signed out, or an unexpected-response error.
 */
export async function getMySubscription(subdomain: string, subscriptionId: string): Promise<MySubscription> {
  const subscription = (await listMySubscriptions(subdomain, renewPath(subdomain, subscriptionId))).find(({ id }) => id === subscriptionId);
  if (!subscription) notFound();
  return subscription;
}
