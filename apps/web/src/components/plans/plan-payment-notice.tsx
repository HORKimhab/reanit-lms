import { useTranslations } from "next-intl";

import { RefreshWhilePending } from "@/components/checkout/refresh-while-pending";
import type { PlanPaymentStatus } from "@/server/schools/plan";

/**
 * Says how the plan payment the owner came back from went, and keeps checking while it is pending.
 *
 * @param props - Component props.
 * @param props.status - The payment's status.
 * @returns The notice.
 */
export function PlanPaymentNotice({ status }: { status: PlanPaymentStatus }) {
  const t = useTranslations("Plans");
  return (
    <p role="status" className={status === "failed" ? "text-sm text-destructive" : "text-sm"}>
      {t(`payment.${status}`)}
      {status === "pending" ? <RefreshWhilePending /> : null}
    </p>
  );
}
