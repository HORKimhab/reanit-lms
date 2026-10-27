import type { StudentPage } from "@reanit/core/schools";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/shells/empty-state";
import { Pager } from "@/components/shells/pager";
import { SearchForm } from "@/components/shells/search-form";

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
      <SearchForm id="student-search" label={t("search")} button={t("searchButton")} q={q} />
      {result.students.length === 0 ? (
        <EmptyState title={t(q ? "noMatchTitle" : "emptyTitle")} text={q ? t("noMatchText", { q }) : t("emptyText")} />
      ) : (
        <>
          <StudentTable rows={result.students} />
          <Pager label={t("pages")} page={result.page} pages={pages} hrefFor={pageHref} />
        </>
      )}
    </div>
  );
}
