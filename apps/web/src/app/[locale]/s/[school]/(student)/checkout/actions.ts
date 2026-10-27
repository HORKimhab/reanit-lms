"use server";

import { bundleCheckoutSchema, checkoutSchema, offerQuerySchema, offlinePaymentSchema, renewSchema, type Discount, type OrderStatus } from "@reanit/core/commerce";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import { getApi } from "@/server/api";
import { checkoutPath, getDiscount, getOrder, ordersPath, type ProductKind } from "@/server/commerce/checkout";
import { gatewayStep, type GatewayStep } from "@/server/commerce/gateway-step";
import { renewPath } from "@/server/commerce/subscriptions";
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
  /** Post PayWay's form, or show a KHQR code until it expires and wait for the order to be paid. */
  | (GatewayStep & { orderId: string })
  /** Show the school's own payment QR image; the student then says they paid, and staff confirm it. */
  | { status: "offline"; qrImageUrl: string; orderId: string }
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

/** The API's answer to starting a payment: the order and the next step, or why it was refused. */
type PaymentAnswer = NonNullable<Awaited<ReturnType<typeof postCheckout>>>;

/**
 * Turns the API's answer to starting a payment into what the browser does next.
 *
 * @param answer The typed client's answer.
 * @param answer.data The order and its next step, on success.
 * @param answer.error The problem, on refusal.
 * @param answer.response The HTTP response.
 * @param returnPath The page to come back to after logging in.
 * @returns What the browser does next.
 * @throws {Error} Next's redirect signal (to the gateway, or to log in), or an unexpected-response error.
 */
function nextStep({ data, error, response }: PaymentAnswer, returnPath: string): CheckoutState {
  const problemType = (error as { type?: string } | undefined)?.type;
  if (response.status === 409 && problemType === ALREADY_ENROLLED) return { status: "enrolled" };
  if (response.status === 400 && problemType === INVALID_COUPON) return { status: "invalidCoupon" };
  if (response.status === 409 || response.status === 400) return { status: "unavailable" };
  checkStudentResponse(response, returnPath);
  // checkStudentResponse returned, so the API answered 2xx with the order and the next step.
  const { orderId, payment } = data!;
  return payment.kind === "offline" ? { status: "offline", qrImageUrl: payment.qrImageUrl, orderId } : { ...gatewayStep(payment), orderId };
}

/**
 * Starts buying a course or bundle with the chosen method. Bind what is bought: `startCheckout.bind(null, school, "course", slug)`.
 * Stripe redirects straight to its hosted page; PayWay, Bakong and the school's offline QR return what the browser shows next.
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
  return answer ? nextStep(answer, checkoutPath(subdomain, kind, slug)) : { status: "unavailable" };
}

/**
 * Pays a subscription's next period or a payment plan's next instalment with the chosen method. Bind
 * it: `startRenewal.bind(null, school, subscriptionId)`.
 *
 * @param subdomain The school's subdomain.
 * @param subscriptionId The subscription.
 * @param _previous The form's last state; unused, but `useActionState` passes it first.
 * @param formData Untrusted `method`. The page's locale goes with it, for the receipt.
 * @returns What the browser does next.
 * @throws {Error} Next's redirect signal (to the gateway, or to log in), or any unexpected failure.
 */
export async function startRenewal(subdomain: string, subscriptionId: string, _previous: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const parsed = renewSchema.safeParse({ method: formData.get("method"), locale: await getLocale() });
  if (!parsed.success) return { status: "unavailable" };
  const answer = await (await getApi()).POST("/schools/by-subdomain/{subdomain}/subscriptions/{subscriptionId}/renew", {
    params: { path: { subdomain, subscriptionId } },
    body: parsed.data,
  });
  return nextStep(answer, renewPath(subdomain, subscriptionId));
}

/** Result of the last "I've paid" submit of an offline QR order: a missing reference, or an order no longer waiting for it. */
export type OfflinePaymentState = { status: "idle" | "invalid" | "closed" };

/**
 * Records that the student paid an offline QR order, with their transaction reference, then opens the
 * order's page, where it waits for the school to confirm it. Bind it: `submitOfflinePayment.bind(null, school)`, then the order.
 *
 * @param subdomain The school's subdomain.
 * @param orderId The order.
 * @param _previous The form's last state; unused, but `useActionState` passes it first.
 * @param formData Untrusted `reference`.
 * @returns `invalid` without a reference, or `closed` when the order no longer waits for an offline payment; on success it redirects instead.
 * @throws {Error} Next's redirect signal (to the order, or to log in), or an unexpected-response error.
 */
export async function submitOfflinePayment(subdomain: string, orderId: string, _previous: OfflinePaymentState, formData: FormData): Promise<OfflinePaymentState> {
  const parsed = offlinePaymentSchema.safeParse({ reference: formData.get("reference") });
  if (!parsed.success) return { status: "invalid" };
  const orderPath = `${ordersPath(subdomain)}/${orderId}`;
  const { response } = await (await getApi()).POST("/schools/by-subdomain/{subdomain}/orders/{orderId}/offline-payment", {
    params: { path: { subdomain, orderId } },
    body: parsed.data,
  });
  if (response.status === 409) return { status: "closed" };
  checkStudentResponse(response, orderPath);
  redirect(orderPath);
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
