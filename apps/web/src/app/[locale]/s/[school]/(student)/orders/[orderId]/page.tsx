import { getTranslations } from "next-intl/server";

import { OrderStatus } from "@/components/checkout/order-status";
import { getOrder } from "@/server/commerce/checkout";

/**
 * An order's status page, where gateways send the student after paying. Someone else's order 404s.
 *
 * @param props - Page props.
 * @param props.params - Route params with the school's subdomain and the order id.
 * @returns The order's status.
 */
export default async function OrderPage({ params }: PageProps<"/[locale]/s/[school]/orders/[orderId]">) {
  const { school, orderId } = await params;
  const [order, t] = await Promise.all([getOrder(school, orderId), getTranslations("Order")]);
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <OrderStatus status={order.status} school={school} />
    </div>
  );
}
