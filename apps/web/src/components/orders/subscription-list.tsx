import { Button } from "@reanit/ui/components/button";
import { useFormatter, useTranslations } from "next-intl";

import { usePriceLabel } from "@/components/pricing/use-price-label";
import { Pill } from "@/components/shells/pill";
import { Link } from "@/i18n/navigation";
import type { MySubscription } from "@/server/commerce/subscriptions";

/** Each status's color: active is good news, lapsed a problem, a paid-off plan neutral. */
const TONE = { active: "success", lapsed: "danger", completed: "muted" } as const;

/**
 * A student's subscriptions and payment plans: what each costs and how far it is paid, with a link to
 * pay the next period of one that is still running or has lapsed.
 *
 * @param props - Component props.
 * @param props.subscriptions - The student's subscriptions, newest first; render nothing when there are none.
 * @param props.renewHref - Builds the page that pays a subscription's next period.
 * @returns A labelled list of subscriptions.
 */
export function SubscriptionList({ subscriptions, renewHref }: { subscriptions: MySubscription[]; renewHref: (subscriptionId: string) => string }) {
  const t = useTranslations("Subscriptions");
  const format = useFormatter();
  const priceLabel = usePriceLabel();

  return (
    <section aria-labelledby="subscriptions-title" className="flex flex-col gap-3">
      <h2 id="subscriptions-title" className="text-lg font-semibold">
        {t("title")}
      </h2>
      <ul className="flex flex-col gap-3">
        {subscriptions.map((subscription) => {
          const { billing } = subscription.price;
          return (
            <li key={subscription.id} className="flex flex-col gap-3 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{subscription.title}</span>
                  <Pill tone={TONE[subscription.status]}>{t(`status.${subscription.status}`)}</Pill>
                </div>
                <p className="text-sm text-muted-foreground">{priceLabel(subscription.price)}</p>
                <p className="text-sm">
                  {billing.kind === "payment_plan"
                    ? t("paidOf", { paid: subscription.paidPeriods, total: billing.installments })
                    : t("paidUntil", { date: format.dateTime(subscription.currentPeriodEnd, { dateStyle: "medium" }) })}
                </p>
              </div>
              {subscription.status === "completed" ? null : (
                <Button asChild variant={subscription.status === "lapsed" ? "default" : "outline"} className="self-start sm:self-center">
                  <Link href={renewHref(subscription.id)}>{t(billing.kind === "payment_plan" ? "payInstallment" : "payNext")}</Link>
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
