"use server";

import { revalidatePath } from "next/cache";

import { getApi } from "@/server/api";
import { checkStaffResponse } from "@/server/schools/staff";

/** The API's answer when the order stopped being paid meanwhile, e.g. another admin refunded it first. */
const NOT_REFUNDABLE = "urn:reanit:problem:order-not-refundable";

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
