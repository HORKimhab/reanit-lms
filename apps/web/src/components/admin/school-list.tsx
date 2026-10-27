import type { PlatformSchoolPage } from "@reanit/core/schools";
import { useFormatter, useTranslations } from "next-intl";

import type { SuspendState } from "@/app/[locale]/admin/actions";
import { Cell, DataTable, RowHeader } from "@/components/dashboard/data-table";
import { EmptyState } from "@/components/shells/empty-state";
import { Pager } from "@/components/shells/pager";
import { SearchForm } from "@/components/shells/search-form";
import { ADMIN_PATHS } from "@/server/admin/console";

import { SuspensionControl } from "./suspension-control";

/**
 * Every school on the platform for its admins: a search box, one page of schools with each owner,
 * plan in force and status, taking a school offline or back, and links to the pages around it.
 *
 * @param props - Component props.
 * @param props.result - The page of schools the API returned.
 * @param props.q - The search the page was loaded with, if any.
 * @param props.suspend - Takes a school offline with the reason.
 * @param props.unsuspend - Brings a school back online.
 * @returns The search form, then the table with its pages, or an empty state.
 */
export function SchoolList({
  result,
  q,
  suspend,
  unsuspend,
}: {
  result: PlatformSchoolPage;
  q?: string;
  suspend: (schoolId: string, state: SuspendState, formData: FormData) => Promise<SuspendState>;
  unsuspend: (schoolId: string) => Promise<void>;
}) {
  const t = useTranslations("Admin.schools");
  const plans = useTranslations("Plans");
  const format = useFormatter();
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));

  /**
   * Formats a day for the table.
   *
   * @param date - The moment.
   * @returns Its medium date.
   */
  function day(date: Date) {
    return format.dateTime(date, { dateStyle: "medium" });
  }

  return (
    <div className="flex flex-col gap-4">
      <SearchForm id="school-search" label={t("search")} button={t("searchButton")} q={q} />
      {result.schools.length === 0 ? (
        <EmptyState title={t("emptyTitle")} text={q ? t("noMatch", { q }) : t("empty")} />
      ) : (
        <>
          <DataTable
            caption={t("caption")}
            columns={[{ label: t("school") }, { label: t("owner") }, { label: t("plan") }, { label: t("created") }, { label: t("status") }, { label: t("actions") }]}
          >
            {result.schools.map((school) => (
              <tr key={school.id}>
                <RowHeader>
                  {school.name}
                  <span className="block font-mono text-xs font-normal text-muted-foreground">{school.subdomain}</span>
                </RowHeader>
                <Cell>{school.ownerEmail ?? "—"}</Cell>
                <Cell>{school.paidUntil ? t("planUntil", { plan: plans(`names.${school.plan}`), date: day(school.paidUntil) }) : plans(`names.${school.plan}`)}</Cell>
                <Cell>{day(school.createdAt)}</Cell>
                <Cell>
                  {school.suspension ? (
                    <span className="text-destructive">{t("suspended", { date: day(school.suspension.at), reason: school.suspension.reason })}</span>
                  ) : (
                    t("online")
                  )}
                </Cell>
                <Cell>
                  <SuspensionControl suspension={school.suspension} suspend={suspend.bind(null, school.id)} unsuspend={unsuspend.bind(null, school.id)} />
                </Cell>
              </tr>
            ))}
          </DataTable>
          <Pager label={t("pages")} page={result.page} pages={pages} hrefFor={(page) => ({ pathname: ADMIN_PATHS.schools, query: { ...(q && { q }), page } })} />
        </>
      )}
    </div>
  );
}
