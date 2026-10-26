import { CURRENCIES, ORDER_STATUSES, type OrderListQuery, type OrderPage } from "@reanit/core/commerce";
import { Button } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";

import { INPUT_CLASS } from "@/components/form/field";
import { EmptyState } from "@/components/shells/empty-state";
import { Pager } from "@/components/shells/pager";

import { OrderTable } from "./order-table";

/** Where the orders list lives; its filter form and page links stay on it. */
const ORDERS_PATH = "/dashboard/orders";

/** The filters a list was loaded with, without the page. */
type OrderFilters = Omit<OrderListQuery, "page">;

/**
 * The school's orders: a filter form (status, course, currency, days placed), one page of orders and
 * links to the pages around it.
 *
 * @param props - Component props.
 * @param props.result - The page of orders the API returned.
 * @param props.filters - The filters the page was loaded with.
 * @param props.courses - The school's courses, to filter by.
 * @returns The filter form, then the table with its pages, or an empty state.
 */
export function OrderList({ result, filters, courses }: { result: OrderPage; filters: OrderFilters; courses: { id: string; title: string }[] }) {
  const t = useTranslations("Orders");
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const isFiltered = Object.values(filters).some(Boolean);

  /**
   * Builds a link to another page of the same filters.
   *
   * @param page - The 1-based page.
   * @returns The link target.
   */
  function pageHref(page: number) {
    return { pathname: ORDERS_PATH, query: { ...filters, page } };
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={ORDERS_PATH} aria-label={t("filters")} className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          {t("statusColumn")}
          <select name="status" defaultValue={filters.status ?? ""} className={INPUT_CLASS}>
            <option value="">{t("any")}</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`status.${status}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {t("course")}
          <select name="courseId" defaultValue={filters.courseId ?? ""} className={INPUT_CLASS}>
            <option value="">{t("any")}</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {t("currency")}
          <select name="currency" defaultValue={filters.currency ?? ""} className={INPUT_CLASS}>
            <option value="">{t("any")}</option>
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {t("from")}
          <input type="date" name="from" defaultValue={filters.from} className={INPUT_CLASS} />
        </label>
        <label className="flex flex-col gap-1">
          {t("to")}
          <input type="date" name="to" defaultValue={filters.to} className={INPUT_CLASS} />
        </label>
        <Button type="submit" variant="outline">
          {t("apply")}
        </Button>
      </form>
      {result.orders.length === 0 ? (
        <EmptyState title={t(isFiltered ? "noMatchTitle" : "emptyTitle")} text={t(isFiltered ? "noMatchText" : "emptyText")} />
      ) : (
        <>
          <OrderTable rows={result.orders} />
          <Pager label={t("pages")} page={result.page} pages={pages} hrefFor={pageHref} />
        </>
      )}
    </div>
  );
}
