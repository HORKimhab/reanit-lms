"use server";

import { revalidatePath } from "next/cache";

import { getApi } from "@/server/api";
import { checkStaffResponse } from "@/server/schools/staff";

/** The API's answer when the order stopped being paid meanwhile, e.g. another admin refunded it first. */
const NOT_REFUNDABLE = "urn:reanit:problem:order-not-refundable";

/** The API's answer when an offline payment was confirmed or rejected meanwhile, e.g. by another admin. */
const OFFLINE_CLOSED = "urn:reanit:problem:offline-payment-closed";

/** Where staff confirm or reject an offline QR payment. */
const OFFLINE_ROUTES = { confirm: "/orders/{id}/confirm-payment", reject: "/orders/{id}/reject-payment" } as const;

/**
 * Refunds an order and refreshes the orders pages, so the order shows as refunded. An order that is
 * no longer paid (refunded meanwhile) is simply shown as it now is.
 *
 * @param orderId The order.
 * @param isRefundedByHand Whether staff already paid the student back themselves (KHQR, PayWay).
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error, e.g. when the gateway refuses.
 */
export async function refundOrder(orderId: string, isRefundedByHand: boolean): Promise<void> {
  const { error, response } = await (await getApi()).POST("/orders/{id}/refund", { params: { path: { id: orderId } }, body: { isRefundedByHand } });
  if ((error as { type?: string } | undefined)?.type !== NOT_REFUNDABLE) checkStaffResponse(response);
  revalidatePath("/dashboard/orders", "layout");
}

/**
 * Confirms that an offline QR payment arrived (the order is paid and enrolls its buyer), or rejects
 * it (the order fails), and refreshes the orders pages. Bind the order: `reviewOfflinePayment.bind(null, order.id)`.
 * A payment another admin handled meanwhile is simply shown as it now is.
 *
 * @param orderId The order.
 * @param decision Confirm or reject.
 * @throws {Error} Next's redirect signal (to log in or to onboarding), or an unexpected-response error.
 */
export async function reviewOfflinePayment(orderId: string, decision: keyof typeof OFFLINE_ROUTES): Promise<void> {
  const { error, response } = await (await getApi()).POST(OFFLINE_ROUTES[decision], { params: { path: { id: orderId } } });
  if ((error as { type?: string } | undefined)?.type !== OFFLINE_CLOSED) checkStaffResponse(response);
  revalidatePath("/dashboard/orders", "layout");
}
