import { orderReference, type OrderDetail } from "@reanit/core/commerce";
import { useFormatter, useTranslations } from "next-intl";

import { OrderLines } from "./order-lines";
import { OrderStatusBadge } from "./order-status-badge";

/** How order times read: the day and the time. */
const WHEN = { dateStyle: "medium", timeStyle: "short" } as const;

/**
 * One order as a receipt: its reference and status, when it was placed, paid and refunded, how it was
 * paid, the bundle and coupon, then what it sold and the total.
 *
 * @param props - Component props.
 * @param props.order - The order.
 * @returns The receipt.
 */
export function ReceiptCard({ order }: { order: OrderDetail }) {
  const t = useTranslations("Orders");
  const methods = useTranslations("Checkout.methods");
  const format = useFormatter();
  const facts = [
    { term: t("placed"), detail: format.dateTime(order.createdAt, WHEN) },
    order.paidAt && { term: t("paid"), detail: format.dateTime(order.paidAt, WHEN) },
    order.refundedAt && { term: t("refunded"), detail: format.dateTime(order.refundedAt, WHEN) },
    { term: t("method"), detail: methods(order.method) },
    order.bundleTitle && { term: t("bundle"), detail: order.bundleTitle },
    order.couponCode && { term: t("coupon"), detail: order.couponCode },
  ].filter((fact): fact is { term: string; detail: string } => Boolean(fact));

  return (
    <article aria-labelledby={`order-${order.id}`} className="flex flex-col gap-4 rounded-xl border p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id={`order-${order.id}`} className="font-semibold">
          {t("reference", { reference: orderReference(order.id) })}
        </h2>
        <OrderStatusBadge status={order.status} />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {facts.map(({ term, detail }) => (
          <div key={term} className="contents">
            <dt className="text-muted-foreground">{term}</dt>
            <dd>{detail}</dd>
          </div>
        ))}
      </dl>
      {order.isRefundedByHand ? <p className="text-sm text-muted-foreground">{t("refundedByHand")}</p> : null}
      <OrderLines order={order} />
    </article>
  );
}
