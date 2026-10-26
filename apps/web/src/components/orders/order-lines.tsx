import type { OrderDetail } from "@reanit/core/commerce";
import { useTranslations } from "next-intl";

import { useMoney } from "@/i18n/format";

/**
 * What an order sold: each course with its amount, then the total, as a receipt lists them.
 *
 * @param props - Component props.
 * @param props.order - The order.
 * @returns A table of the order's courses and total.
 */
export function OrderLines({ order }: { order: OrderDetail }) {
  const t = useTranslations("Orders");
  const money = useMoney();

  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{t("linesCaption")}</caption>
      <thead className="text-left text-muted-foreground">
        <tr>
          <th scope="col" className="py-1 font-normal">
            {t("course")}
          </th>
          <th scope="col" className="py-1 text-right font-normal">
            {t("amount")}
          </th>
        </tr>
      </thead>
      <tbody>
        {order.items.map((item) => (
          <tr key={item.courseId}>
            <th scope="row" className="py-1 text-left font-normal">
              {item.title}
            </th>
            <td className="py-1 text-right tabular-nums">{money(item.amount, item.currency)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="border-t font-medium">
        <tr>
          <th scope="row" className="pt-2 text-left">
            {t("total")}
          </th>
          <td className="pt-2 text-right tabular-nums">{money(order.total.amount, order.total.currency)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
