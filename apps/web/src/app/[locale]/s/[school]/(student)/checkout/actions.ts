"use server";

import { checkoutSchema, type OrderStatus } from "@reanit/core/commerce";
import { redirect } from "next/navigation";

import { getApi } from "@/server/api";
import { getOrder } from "@/server/commerce/checkout";
import { checkStudentResponse } from "@/server/schools/student";

/** Problem type of a checkout for a course the buyer already has. */
const ALREADY_ENROLLED = "urn:reanit:problem:already-enrolled";

/** Result of the last checkout submit, shown by the checkout form (WEB-14). */
export type CheckoutState =
  | { status: "idle" }
  /** Post these fields from the browser to the gateway's page (PayWay). */
  | { status: "form"; action: string; fields: Record<string, string> }
  /** Show this KHQR code until it expires, and wait for the order to be paid. */
  | { status: "qr"; qr: string; expiresAt: string; orderId: string }
  | { status: "enrolled" }
  /** The method cannot take this payment (not configured, wrong currency) or the course lost its price. */
  | { status: "unavailable" };

/**
 * Starts buying a course with the chosen method. Bind the school and course: `startCheckout.bind(null, school, slug)`.
 * Stripe redirects straight to its hosted page; PayWay and Bakong return what the browser shows next.
 *
 * @param subdomain The school's subdomain.
 * @param courseSlug The course.
 * @param _previous The form's last state; unused, but `useActionState` passes it first.
 * @param formData Untrusted `method`.
 * @returns What the browser does next.
 * @throws {Error} Next's redirect signal (to the gateway, or to log in), or any unexpected failure.
 */
export async function startCheckout(subdomain: string, courseSlug: string, _previous: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const parsed = checkoutSchema.safeParse({ courseSlug, method: formData.get("method") });
  if (!parsed.success) return { status: "unavailable" };
  const { data, error, response } = await (await getApi()).POST("/schools/by-subdomain/{subdomain}/checkout", {
    params: { path: { subdomain } },
    body: parsed.data,
  });
  if (response.status === 409 && (error as { type?: string } | undefined)?.type === ALREADY_ENROLLED) return { status: "enrolled" };
  if (response.status === 409 || response.status === 400) return { status: "unavailable" };
  checkStudentResponse(response, `/s/${subdomain}/checkout/${courseSlug}`);
  // checkStudentResponse returned, so the API answered 2xx with the order and the next step.
  const { orderId, payment } = data!;
  switch (payment.kind) {
    case "redirect":
      return redirect(payment.url);
    case "form":
      return { status: "form", action: payment.action, fields: payment.fields };
    case "qr":
      return { status: "qr", qr: payment.qr, expiresAt: payment.expiresAt, orderId };
  }
}

/**
 * Reads an order's status while the KHQR code is shown; reading it lets the API check the payment with the gateway.
 *
 * @param subdomain The school's subdomain.
 * @param orderId The order.
 * @returns The status.
 * @throws {Error} Next's redirect or not-found signal, or an unexpected-response error.
 */
export async function getOrderStatus(subdomain: string, orderId: string): Promise<OrderStatus> {
  return (await getOrder(subdomain, orderId)).status;
}
