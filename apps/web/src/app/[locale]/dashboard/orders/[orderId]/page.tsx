import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { OrderBuyer } from "@/components/dashboard/order-buyer";
import { ReceiptCard } from "@/components/orders/receipt-card";
import { Link } from "@/i18n/navigation";
import { getSchoolOrder } from "@/server/commerce/orders";
import { canManageSchool, getStaffSchool } from "@/server/schools/staff";

/**
 * One of the school's orders: who bought it, and its receipt. Instructors see why they cannot see it.
 *
 * @param props - Page props.
 * @param props.params - Route params with the order's id.
 * @returns A link back to the orders, the buyer and the receipt, or a notice for instructors.
 * @throws {Error} Next's not-found signal when the school has no such order.
 */
export default async function DashboardOrder({ params }: PageProps<"/[locale]/dashboard/orders/[orderId]">) {
  const [{ orderId }, t, { role }] = await Promise.all([params, getTranslations("Orders"), getStaffSchool()]);
  const order = canManageSchool(role) ? await getSchoolOrder(orderId) : null;
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link href="/dashboard/orders" className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft aria-hidden className="size-4" />
        {t("allOrders")}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{t("detailTitle")}</h1>
      {order ? (
        <>
          <OrderBuyer buyer={order.buyer} />
          <ReceiptCard order={order} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("staffOnly")}</p>
      )}
    </div>
  );
}
