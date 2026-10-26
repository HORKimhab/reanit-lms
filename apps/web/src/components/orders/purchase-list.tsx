import type { OrderPage } from "@reanit/core/commerce";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";

import { EmptyState } from "@/components/shells/empty-state";
import { Pager } from "@/components/shells/pager";

import { ReceiptCard } from "./receipt-card";

/**
 * A student's purchases in a school: one receipt per order, newest first, with links to other pages.
 *
 * @param props - Component props.
 * @param props.result - The page of the student's orders.
 * @param props.hrefFor - Builds the link to another page of purchases.
 * @returns The receipts and the pager, or an empty state.
 */
export function PurchaseList({ result, hrefFor }: { result: OrderPage; hrefFor: ComponentProps<typeof Pager>["hrefFor"] }) {
  const t = useTranslations("Purchases");
  if (result.orders.length === 0) return <EmptyState title={t("emptyTitle")} text={t("emptyText")} />;
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="flex flex-col gap-4">
      {result.orders.map((order) => (
        <ReceiptCard key={order.id} order={order} />
      ))}
      <Pager label={t("pages")} page={result.page} pages={pages} hrefFor={hrefFor} />
    </div>
  );
}
