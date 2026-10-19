import type { StudentPage } from "@reanit/core/schools";
import { Button } from "@reanit/ui/components/button";
import { cn } from "@reanit/ui/lib/utils";
import { useTranslations } from "next-intl";

import { INPUT_CLASS } from "@/components/form/field";
import { Link } from "@/i18n/navigation";

import { EmptyState } from "./data-table";
import { StudentTable } from "./student-table";

/** Where the students list lives; search and page links stay on it. */
const STUDENTS_PATH = "/dashboard/students";

/**
 * The students list: a search box, one page of students and links to the pages around it.
 *
 * @param props - Component props.
 * @param props.result - The page of students the API returned.
 * @param props.q - The search the page was loaded with, if any.
 * @returns The search form, then the table with its pages, or an empty state.
 */
export function StudentList({ result, q }: { result: StudentPage; q?: string }) {
  const t = useTranslations("Students");
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));

  /**
   * Builds a link to another page of the same search.
   *
   * @param page - The 1-based page.
   * @returns The link target.
   */
  function pageHref(page: number) {
    return { pathname: STUDENTS_PATH, query: { ...(q && { q }), page } };
  }

  return (
    <div className="flex flex-col gap-4">
      <form role="search" className="flex gap-2">
        <label htmlFor="student-search" className="sr-only">
          {t("search")}
        </label>
        <input
          id="student-search"
          type="search"
          name="q"
          defaultValue={q}
          placeholder={t("search")}
          className={cn(INPUT_CLASS, "w-full max-w-sm")}
        />
        <Button type="submit" variant="outline">
          {t("searchButton")}
        </Button>
      </form>
      {result.students.length === 0 ? (
        <EmptyState title={t(q ? "noMatchTitle" : "emptyTitle")} text={q ? t("noMatchText", { q }) : t("emptyText")} />
      ) : (
        <>
          <StudentTable rows={result.students} />
          <nav aria-label={t("pages")} className="flex items-center justify-between gap-4 text-sm">
            {result.page > 1 ? (
              <Link href={pageHref(result.page - 1)} className="text-primary hover:underline">
                {t("previous")}
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground">{t("pageOf", { page: result.page, pages })}</span>
            {result.page < pages ? (
              <Link href={pageHref(result.page + 1)} className="text-primary hover:underline">
                {t("next")}
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </>
      )}
    </div>
  );
}
