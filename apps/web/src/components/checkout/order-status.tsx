import type { OrderStatus as Status } from "@reanit/core/commerce";
import { Button } from "@reanit/ui/components/button";
import { CircleCheck, CircleX, Loader } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { RefreshWhilePending } from "./refresh-while-pending";

const ICONS = { pending: Loader, paid: CircleCheck, failed: CircleX, refunded: CircleX } as const;

/**
 * An order's status after checkout: waiting (and re-checking), paid, or not paid.
 *
 * @param props - Component props.
 * @param props.status - The order's status.
 * @param props.school - The school's subdomain.
 * @returns The status with the next link: my courses once paid, the catalog when it was not.
 */
export function OrderStatus({ status, school }: { status: Status; school: string }) {
  const t = useTranslations("Order");
  const Icon = ICONS[status];

  return (
    <div className="flex flex-col items-start gap-4">
      <p role="status" className="flex items-center gap-2 text-lg">
        <Icon aria-hidden className={status === "paid" ? "size-5 text-success" : "size-5 text-muted-foreground"} />
        {t(status)}
      </p>
      {status === "pending" ? <RefreshWhilePending /> : null}
      {status === "paid" ? (
        <Button asChild>
          <Link href={`/s/${school}/my-courses`}>{t("myCourses")}</Link>
        </Button>
      ) : null}
      {status === "failed" || status === "refunded" ? (
        <Button asChild variant="outline">
          <Link href={`/s/${school}`}>{t("browse")}</Link>
        </Button>
      ) : null}
    </div>
  );
}
