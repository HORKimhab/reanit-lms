import { getTranslations } from "next-intl/server";

import { PurchaseList } from "@/components/orders/purchase-list";
import { listMyOrders, purchasesPageFrom } from "@/server/commerce/orders";

/**
 * The student's purchases in the school: a receipt for each of their orders, newest first.
 *
 * @param props - Page props.
 * @param props.params - Route params with the school's subdomain.
 * @param props.searchParams - `page` (1-based).
 * @returns The page heading and the receipts.
 */
export default async function Purchases({ params, searchParams }: PageProps<"/[locale]/s/[school]/purchases">) {
  const { school } = await params;
  const path = `/s/${school}/purchases`;
  const [t, result] = await Promise.all([getTranslations("Purchases"), listMyOrders(school, purchasesPageFrom(await searchParams), path)]);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <PurchaseList result={result} hrefFor={(page) => ({ pathname: path, query: { page } })} />
    </div>
  );
}
