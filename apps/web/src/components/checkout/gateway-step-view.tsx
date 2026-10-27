"use client";

import type { OrderStatus } from "@reanit/core/commerce";

import type { GatewayStep } from "@/server/commerce/gateway-step";

import { GatewayForm } from "./gateway-form";
import { KhqrPayment } from "./khqr-payment";

/**
 * Shows a gateway's next step: posts PayWay's form, or shows a KHQR code and waits for the payment.
 *
 * @param props - Component props.
 * @param props.step - The step.
 * @param props.priceLabel - The formatted amount, for the code's accessible name.
 * @param props.waitHref - Where to go once a KHQR payment is no longer pending.
 * @param props.checkStatus - Reads the payment's status while the code is shown.
 * @returns The form or the code.
 */
export function GatewayStepView({ step, priceLabel, waitHref, checkStatus }: { step: GatewayStep; priceLabel: string; waitHref: string; checkStatus: () => Promise<OrderStatus> }) {
  if (step.status === "form") return <GatewayForm action={step.action} fields={step.fields} />;
  return <KhqrPayment qr={step.qr} expiresAt={step.expiresAt} priceLabel={priceLabel} orderHref={waitHref} checkStatus={checkStatus} />;
}
