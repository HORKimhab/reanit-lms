import { useTranslations } from "next-intl";

import { Cell, DataTable, RowHeader } from "@/components/dashboard/data-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { EmptyState } from "@/components/shells/empty-state";
import { usePriceLabel } from "@/components/pricing/use-price-label";
import { Link } from "@/i18n/navigation";
import type { BundleView } from "@/server/commerce/bundles";

/**
 * The school's bundles with how many courses each holds, its price and its publishing status.
 *
 * @param props - Component props.
 * @param props.bundles - The bundles, newest first.
 * @returns A table with each title linking to its editor, or an empty state when there are none.
 */
export function BundleTable({ bundles }: { bundles: BundleView[] }) {
  const t = useTranslations("Bundles");
  const dashboard = useTranslations("Dashboard");
  const priceLabel = usePriceLabel();

  if (bundles.length === 0) return <EmptyState title={t("emptyTitle")} text={t("emptyText")} />;

  return (
    <DataTable
      caption={t("caption")}
      columns={[{ label: t("bundle") }, { label: t("courses"), isNumeric: true }, { label: t("price"), isNumeric: true }, { label: dashboard("status") }]}
    >
      {bundles.map((bundle) => (
        <tr key={bundle.id}>
          <RowHeader>
            <Link href={`/dashboard/bundles/${bundle.slug}`} className="hover:text-primary hover:underline">
              {bundle.title}
            </Link>
          </RowHeader>
          <Cell isNumeric>{t("courseCount", { count: bundle.courses.length })}</Cell>
          <Cell isNumeric>{bundle.price ? priceLabel(bundle.price) : t("notPriced")}</Cell>
          <Cell>
            <StatusBadge status={bundle.status} />
          </Cell>
        </tr>
      ))}
    </DataTable>
  );
}
