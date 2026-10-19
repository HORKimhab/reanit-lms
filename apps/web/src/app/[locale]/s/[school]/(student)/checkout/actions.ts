"use server";

import { bundleCheckoutSchema, checkoutSchema, offerQuerySchema, type Discount, type OrderStatus } from "@reanit/core/commerce";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { getApi } from "@/server/api";
import { checkoutPath, getDiscount, getOrder, type ProductKind } from "@/server/commerce/checkout";
import { checkStudentResponse } from "@/server/schools/student";

/** Problem type of a checkout for a course the buyer already has. */
const ALREADY_ENROLLED = "urn:reanit:problem:already-enrolled";

/** Problem type of a coupon that cannot be used on the course. */
const INVALID_COUPON = "urn:reanit:problem:invalid-coupon";

/** Answer to a coupon the student typed: what it takes off, or that it cannot be used. */
export type CouponCheck = { status: "applied"; discount: Discount } | { status: "invalid" };

/** Result of the last checkout submit, shown by the checkout form (WEB-14). */
export type CheckoutState =
  | { status: "idle" }
  /** Post these fields from the browser to the gateway's page (PayWay). */
  | { status: "form"; action: string; fields: Record<string, string> }
  /** Show this KHQR code until it expires, and wait for the order to be paid. */
  | { status: "qr"; qr: string; expiresAt: string; orderId: string }
  | { status: "enrolled" }
  /** The coupon stopped working between applying it and paying (expired, used up). */
  | { status: "invalidCoupon" }
  /** The method cannot take this payment (not configured, wrong currency) or the course lost its price. */
  | { status: "unavailable" };

/**
 * Checks a coupon the student typed against a course's or bundle's price. Bind what is bought:
 * `checkCoupon.bind(null, school, "course", slug)`.
 *
 * @param subdomain The school's subdomain.
 * @param kind Whether a course or a bundle is bought.
 * @param slug The course's or bundle's slug.
 * @param code Untrusted coupon code, as typed.
 * @returns The discount, or `invalid` when the code is malformed, unknown or cannot be used on this price.
 * @throws {Error} Next's not-found signal for an unknown school, course or bundle, or an unexpected-response error.
 */
export async function checkCoupon(subdomain: string, kind: ProductKind, slug: string, code: string): Promise<CouponCheck> {
  const parsed = offerQuerySchema.safeParse({ coupon: code });
  const discount = parsed.success && parsed.data.coupon ? await getDiscount(subdomain, slug, parsed.data.coupon, kind) : null;
  return discount ? { status: "applied", discount } : { status: "invalid" };
}

/**
 * Asks the API to start buying a course or bundle with the form's choices.
 *
 * @param subdomain The school's subdomain.
 * @param kind Whether a course or a bundle is bought.
 * @param slug The course's or bundle's slug.
 * @param formData Untrusted `method` and optional `couponCode`.
 * @returns The typed client's answer, or null when the form does not parse.
 */
async function postCheckout(subdomain: string, kind: ProductKind, slug: string, formData: FormData) {
  const choices = { method: formData.get("method"), couponCode: formData.get("couponCode") || undefined, locale: await getLocale() };
  const params = { path: { subdomain } };
  if (kind === "course") {
    const parsed = checkoutSchema.safeParse({ ...choices, courseSlug: slug });
    return parsed.success ? (await getApi()).POST("/schools/by-subdomain/{subdomain}/checkout", { params, body: parsed.data }) : null;
  }
  const parsed = bundleCheckoutSchema.safeParse({ ...choices, bundleSlug: slug });
  return parsed.success ? (await getApi()).POST("/schools/by-subdomain/{subdomain}/bundle-checkout", { params, body: parsed.data }) : null;
}

/**
 * Starts buying a course or bundle with the chosen method. Bind what is bought: `startCheckout.bind(null, school, "course", slug)`.
 * Stripe redirects straight to its hosted page; PayWay and Bakong return what the browser shows next.
 *
 * @param subdomain The school's subdomain.
 * @param kind Whether a course or a bundle is bought.
 * @param slug The course's or bundle's slug.
 * @param _previous The form's last state; unused, but `useActionState` passes it first.
 * @param formData Untrusted `method` and optional `couponCode`. The page's locale goes with it, for the buyer's receipt and welcome emails.
 * @returns What the browser does next.
 * @throws {Error} Next's redirect signal (to the gateway, or to log in), or any unexpected failure.
 */
export async function startCheckout(
  subdomain: string,
  kind: ProductKind,
  slug: string,
  _previous: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const answer = await postCheckout(subdomain, kind, slug, formData);
  if (!answer) return { status: "unavailable" };
  const { data, error, response } = answer;
  const problemType = (error as { type?: string } | undefined)?.type;
  if (response.status === 409 && problemType === ALREADY_ENROLLED) return { status: "enrolled" };
  if (response.status === 400 && problemType === INVALID_COUPON) return { status: "invalidCoupon" };
  if (response.status === 409 || response.status === 400) return { status: "unavailable" };
  checkStudentResponse(response, checkoutPath(subdomain, kind, slug));
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
