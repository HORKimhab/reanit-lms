import type { SchoolPlan } from "@reanit/core/schools";
import type { PaymentMethod } from "@reanit/core/commerce";
import { z } from "zod";

import { getApi } from "../api";
import { checkStaffResponse } from "./staff";

/** Where a plan payment stands. */
export type PlanPaymentStatus = "pending" | "paid" | "failed";

/** The plan page's path; gateways send the owner back to it with `?planPayment=<id>`. */
export const PLAN_PATH = "/dashboard/plan";

const paymentQuerySchema = z.object({ planPayment: z.uuid() });

/**
 * Reads the plan payment the owner came back from, out of the plan page's URL.
 *
 * @param query The page's search params.
 * @returns The payment's id, or null when there is none or it is malformed.
 */
export function planPaymentFrom(query: Record<string, string | string[] | undefined>): string | null {
  const parsed = paymentQuerySchema.safeParse(query);
  return parsed.success ? parsed.data.planPayment : null;
}

/**
 * Loads the signed-in owner's or admin's school's plan.
 *
 * @returns The plan in force, its terms, what was last paid for with its period end as a date, and the methods a plan can be paid with.
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
export async function getSchoolPlan(): Promise<SchoolPlan & { methods: PaymentMethod[] }> {
  const { data, response } = await (await getApi()).GET("/schools/current/plan");
  checkStaffResponse(response);
  // checkStaffResponse returned, so the API answered 2xx with the plan.
  const { paid, ...plan } = data!;
  return { ...plan, paid: paid && { ...paid, periodEnd: new Date(paid.periodEnd) } };
}

/**
 * Reads a plan payment's status; reading it has the API check a pending KHQR or PayWay payment with the gateway.
 *
 * @param paymentId The payment.
 * @returns Its status.
 * @throws {Error} Next's not-found signal for a payment the school does not have, a redirect signal, or an unexpected-response error.
 */
export async function getPlanPaymentStatus(paymentId: string): Promise<PlanPaymentStatus> {
  const { data, response } = await (await getApi()).GET("/schools/current/plan/payments/{id}", { params: { path: { id: paymentId } } });
  checkStaffResponse(response);
  // checkStaffResponse returned, so the API answered 2xx with the status.
  return data!.status;
}
