import type { OrderDetail } from "@reanit/core/commerce";
import { useTranslations } from "next-intl";

/**
 * Who placed an order, for the dashboard's order detail.
 *
 * @param props - Component props.
 * @param props.buyer - The buyer.
 * @returns The buyer's name (when they gave one) and email.
 */
export function OrderBuyer({ buyer }: { buyer: OrderDetail["buyer"] }) {
  const t = useTranslations("Orders");
  return (
    <section aria-labelledby="order-buyer" className="flex flex-col gap-1 rounded-xl border p-5 text-sm">
      <h2 id="order-buyer" className="font-semibold">
        {t("buyer")}
      </h2>
      {buyer.name ? <p>{buyer.name}</p> : null}
      <p className="text-muted-foreground">{buyer.email}</p>
    </section>
  );
}
