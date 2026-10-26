import { orderReference, type OrderDetail } from "@reanit/core/commerce";
import { useFormatter, useTranslations } from "next-intl";

import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { useMoney } from "@/i18n/format";
import { Link } from "@/i18n/navigation";

import { Cell, DataTable, RowHeader } from "./data-table";

/**
 * The school's orders: reference (linking to the order), buyer, courses, total, status and when placed.
 *
 * @param props - Component props.
 * @param props.rows - Orders, in display order; render an empty state instead when there are none.
 * @returns A table of orders.
 */
export function OrderTable({ rows }: { rows: OrderDetail[] }) {
  const t = useTranslations("Orders");
  const format = useFormatter();
  const money = useMoney();

  return (
    <DataTable
      caption={t("caption")}
      columns={[
        { label: t("order") },
        { label: t("buyer") },
        { label: t("courses") },
        { label: t("total"), isNumeric: true },
        { label: t("statusColumn") },
        { label: t("placed") },
      ]}
    >
      {rows.map((order) => (
        <tr key={order.id}>
          <RowHeader>
            <Link href={`/dashboard/orders/${order.id}`} className="font-mono text-primary hover:underline">
              {orderReference(order.id)}
            </Link>
          </RowHeader>
          <Cell>{order.buyer.name ?? order.buyer.email}</Cell>
          <Cell>{format.list(order.items.map((item) => item.title))}</Cell>
          <Cell isNumeric>{money(order.total.amount, order.total.currency)}</Cell>
          <Cell>
            <OrderStatusBadge status={order.status} />
          </Cell>
          <Cell>{format.dateTime(order.createdAt, { dateStyle: "medium" })}</Cell>
        </tr>
      ))}
    </DataTable>
  );
}
