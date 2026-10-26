import { getTranslations } from "next-intl/server";

import { PurchaseList } from "@/components/orders/purchase-list";
import { SubscriptionList } from "@/components/orders/subscription-list";
import { listMyOrders, purchasesPageFrom } from "@/server/commerce/orders";
import { listMySubscriptions, renewPath } from "@/server/commerce/subscriptions";

/**
 * The student's purchases in the school: their subscriptions and payment plans, with a way to pay the
 * next period, then a receipt for each of their orders, newest first.
 *
 * @param props - Page props.
 * @param props.params - Route params with the school's subdomain.
 * @param props.searchParams - `page` (1-based).
 * @returns The page heading, the subscriptions (when there are any) and the receipts.
 */
export default async function Purchases({ params, searchParams }: PageProps<"/[locale]/s/[school]/purchases">) {
  const { school } = await params;
  const path = `/s/${school}/purchases`;
  const [t, result, subscriptions] = await Promise.all([
    getTranslations("Purchases"),
    listMyOrders(school, purchasesPageFrom(await searchParams), path),
    listMySubscriptions(school, path),
  ]);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      {subscriptions.length > 0 ? <SubscriptionList subscriptions={subscriptions} renewHref={(id) => renewPath(school, id)} /> : null}
      <PurchaseList result={result} hrefFor={(page) => ({ pathname: path, query: { page } })} />
    </div>
  );
}
