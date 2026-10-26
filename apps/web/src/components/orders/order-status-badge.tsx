import type { OrderStatus } from "@reanit/core/commerce";
import { useTranslations } from "next-intl";

import { Pill } from "@/components/shells/pill";

/** Each status's color: paid is good news, failed a problem, the rest neutral. */
const TONE = { pending: "muted", paid: "success", failed: "danger", refunded: "muted" } as const;

/**
 * An order's status as a small colored label.
 *
 * @param props - Component props.
 * @param props.status - Pending, paid, failed or refunded.
 * @returns The label.
 */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations("Orders.status");
  return <Pill tone={TONE[status]}>{t(status)}</Pill>;
}
