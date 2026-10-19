import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";

import { Link } from "@/i18n/navigation";

/** Where a page link goes. */
type Href = ComponentProps<typeof Link>["href"];

/**
 * Links to the pages before and after the current one of a paged list, with where it is.
 *
 * @param props - Component props.
 * @param props.label - Accessible name of the navigation, naming the list.
 * @param props.page - The current 1-based page.
 * @param props.pages - How many pages there are; at least 1.
 * @param props.hrefFor - Builds the link to another page of the same list.
 * @returns The navigation, with only the links that lead somewhere.
 */
export function Pager({ label, page, pages, hrefFor }: { label: string; page: number; pages: number; hrefFor: (page: number) => Href }) {
  const t = useTranslations("Pager");
  return (
    <nav aria-label={label} className="flex items-center justify-between gap-4 text-sm">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="text-primary hover:underline">
          {t("previous")}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted-foreground">{t("pageOf", { page, pages })}</span>
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className="text-primary hover:underline">
          {t("next")}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
