"use server";

import { planCheckoutSchema } from "@reanit/core/schools";
import { getLocale } from "next-intl/server";

import { getApi } from "@/server/api";
import { gatewayStep, type GatewayStep } from "@/server/commerce/gateway-step";
import { getPlanPaymentStatus, type PlanPaymentStatus } from "@/server/schools/plan";
import { checkStaffResponse } from "@/server/schools/staff";

/** Result of the last plan checkout, shown by the plan checkout form. */
export type PlanCheckoutState =
  | { status: "idle" }
  /** Post PayWay's form, or show a KHQR code until it expires and wait for the payment. */
  | (GatewayStep & { paymentId: string })
  /** The method cannot take a plan payment. */
  | { status: "unavailable" };

/**
 * Starts paying the platform for a period of a plan with the chosen method, in the page's language.
 *
 * @param _previous The form's last state; unused, but `useActionState` passes it first.
 * @param formData Untrusted `plan`, `interval` and `method`.
 * @returns What the browser does next: a PayWay form or a KHQR code; a redirect leaves the page instead.
 * @throws {Error} Next's redirect signal (to the gateway, to log in or to onboarding), or an unexpected-response error.
 */
export async function startPlanCheckout(_previous: PlanCheckoutState, formData: FormData): Promise<PlanCheckoutState> {
  const parsed = planCheckoutSchema.safeParse({ plan: formData.get("plan"), interval: formData.get("interval"), method: formData.get("method"), locale: await getLocale() });
  if (!parsed.success) return { status: "unavailable" };
  const { data, response } = await (await getApi()).POST("/schools/current/plan/checkout", { body: parsed.data });
  if (response.status === 400) return { status: "unavailable" };
  checkStaffResponse(response);
  // checkStaffResponse returned, so the API answered 2xx with the payment and the next step.
  const { paymentId, payment } = data!;
  return { ...gatewayStep(payment), paymentId };
}

/**
 * Reads a plan payment's status while its KHQR code is shown.
 *
 * @param paymentId The payment.
 * @returns Its status.
 * @throws {Error} Next's not-found or redirect signal, or an unexpected-response error.
 */
export async function checkPlanPayment(paymentId: string): Promise<PlanPaymentStatus> {
  return getPlanPaymentStatus(paymentId);
}
