"use server";

import { recordPayoutSchema, toMinorUnits } from "@reanit/core/commerce";
import { suspendSchoolSchema } from "@reanit/core/schools";
import { revalidatePath } from "next/cache";

import { getApi } from "@/server/api";
import { ADMIN_PATHS, checkAdminResponse } from "@/server/admin/console";

/** Result of the last suspension, shown by the school's suspend form. */
export type SuspendState = { status: "idle" | "invalid" };

/** Result of the last payout record, shown by the payout's form; `exceeds` means more than the school's available balance. */
export type RecordPayoutState = { status: "idle" | "recorded" | "invalid" | "exceeds" };

/** Where a plan payment decision goes. */
const DECISION_ROUTES = { confirm: "/admin/plan-payments/{id}/confirm", reject: "/admin/plan-payments/{id}/reject" } as const;

/** The API's answer to a plan payment another admin decided meanwhile. */
const PLAN_PAYMENT_CLOSED = "urn:reanit:problem:plan-payment-closed";

/**
 * Takes a school offline with the reason, then refreshes the schools list. Bind the school: `suspendSchool.bind(null, school.id)`.
 *
 * @param schoolId The school.
 * @param _previous The form's last state; unused, but `useActionState` passes it first.
 * @param formData Untrusted `reason`.
 * @returns `invalid` without a reason; on success the list refreshes and the form is gone.
 * @throws {Error} Next's redirect or not-found signal, or an unexpected-response error.
 */
export async function suspendSchool(schoolId: string, _previous: SuspendState, formData: FormData): Promise<SuspendState> {
  const parsed = suspendSchoolSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) return { status: "invalid" };
  const { response } = await (await getApi()).PUT("/admin/schools/{id}/suspension", { params: { path: { id: schoolId } }, body: parsed.data });
  checkAdminResponse(response);
  revalidatePath(ADMIN_PATHS.schools);
  return { status: "idle" };
}

/**
 * Brings a suspended school back online, then refreshes the schools list.
 *
 * @param schoolId The school.
 * @throws {Error} Next's redirect or not-found signal, or an unexpected-response error.
 */
export async function unsuspendSchool(schoolId: string): Promise<void> {
  const { response } = await (await getApi()).DELETE("/admin/schools/{id}/suspension", { params: { path: { id: schoolId } } });
  checkAdminResponse(response);
  revalidatePath(ADMIN_PATHS.schools);
}

/**
 * Confirms that a creator's transfer to the platform's QR arrived (the plan moves on), or rejects it,
 * then refreshes the list. A payment another admin decided meanwhile simply leaves the list.
 *
 * @param paymentId The plan payment.
 * @param decision Confirm or reject.
 * @throws {Error} Next's redirect or not-found signal, or an unexpected-response error.
 */
export async function decidePlanPayment(paymentId: string, decision: keyof typeof DECISION_ROUTES): Promise<void> {
  const { error, response } = await (await getApi()).POST(DECISION_ROUTES[decision], { params: { path: { id: paymentId } } });
  if ((error as { type?: string } | undefined)?.type !== PLAN_PAYMENT_CLOSED) checkAdminResponse(response);
  revalidatePath(ADMIN_PATHS.planPayments);
}

/**
 * Records a transfer made to a school, then refreshes the payouts due. The amount is typed in major
 * units and the day is the transfer's, at the start of the admin's day.
 *
 * @param _previous The form's last state; unused, but `useActionState` passes it first.
 * @param formData Untrusted `schoolId`, `currency`, `amount`, `paidAt` (an ISO date-time) and `reference`.
 * @returns `recorded`, `invalid` when a field is wrong, or `exceeds` when it is more than the available balance.
 * @throws {Error} Next's redirect or not-found signal, or an unexpected-response error.
 */
export async function recordPayout(_previous: RecordPayoutState, formData: FormData): Promise<RecordPayoutState> {
  const currency = String(formData.get("currency"));
  const parsed = recordPayoutSchema.safeParse({
    schoolId: formData.get("schoolId"),
    currency,
    amount: toMinorUnits(String(formData.get("amount")), currency),
    paidAt: formData.get("paidAt"),
    reference: formData.get("reference"),
  });
  if (!parsed.success) return { status: "invalid" };
  const { response } = await (await getApi()).POST("/admin/payouts", { body: { ...parsed.data, paidAt: parsed.data.paidAt.toISOString() } });
  if (response.status === 409) return { status: "exceeds" };
  checkAdminResponse(response);
  revalidatePath(ADMIN_PATHS.payouts);
  return { status: "recorded" };
}
