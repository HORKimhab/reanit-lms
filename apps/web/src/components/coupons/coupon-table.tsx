import type { Coupon } from "@reanit/core/commerce";
import { Button } from "@reanit/ui/components/button";
import { Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Cell, DataTable, RowHeader } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/shells/empty-state";
import { useMoney } from "@/i18n/format";

/** Percent off is stored as a whole number out of this. */
const WHOLE_PERCENT = 100;

/**
 * The school's coupons: code, discount, uses against the limit and when each ends, with a delete
 * button per coupon.
 *
 * @param props - Component props.
 * @param props.coupons - The coupons, newest first.
 * @param props.deleteAction - Deletes a coupon; bound to its id per row.
 * @returns The table, or an empty state when the school has no coupons.
 */
export function CouponTable({ coupons, deleteAction }: { coupons: Coupon[]; deleteAction: (couponId: string) => Promise<void> }) {
  const t = useTranslations("Coupons");
  const format = useFormatter();
  const money = useMoney();

  if (coupons.length === 0) return <EmptyState title={t("emptyTitle")} text={t("emptyText")} />;

  return (
    <DataTable
      caption={t("caption")}
      columns={[{ label: t("code") }, { label: t("discount") }, { label: t("uses"), isNumeric: true }, { label: t("ends") }, { label: t("actions") }]}
    >
      {coupons.map((coupon) => (
        <tr key={coupon.id}>
          <RowHeader>
            <span className="font-mono">{coupon.code}</span>
          </RowHeader>
          <Cell>
            {t("off", {
              amount:
                coupon.kind === "percent"
                  ? format.number(coupon.percentOff / WHOLE_PERCENT, { style: "percent" })
                  : money(coupon.amountOff, coupon.currency),
            })}
          </Cell>
          <Cell isNumeric>
            {coupon.maxRedemptions === null
              ? format.number(coupon.redemptions)
              : t("usesOf", { used: format.number(coupon.redemptions), max: format.number(coupon.maxRedemptions) })}
          </Cell>
          <Cell>{coupon.expiresAt ? format.dateTime(coupon.expiresAt, { dateStyle: "medium", timeStyle: "short" }) : t("never")}</Cell>
          <Cell>
            <form action={deleteAction.bind(null, coupon.id)}>
              <Button type="submit" variant="ghost" size="icon" aria-label={t("delete", { code: coupon.code })}>
                <Trash2 aria-hidden className="size-4" />
              </Button>
            </form>
          </Cell>
        </tr>
      ))}
    </DataTable>
  );
}
