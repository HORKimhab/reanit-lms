import { getTranslations } from "next-intl/server";

import { SchoolHeader } from "@/components/shells/school-header";
import { requireMockSchool } from "@/mocks/schools";

/**
 * Public school site shell: sticky header, content and footer.
 *
 * @param props - Layout props.
 * @param props.children - The site page.
 * @param props.params - Route params with the school slug.
 * @returns The header, page and footer.
 */
export default async function SchoolSiteLayout({ children, params }: LayoutProps<"/[locale]/s/[school]">) {
  const school = requireMockSchool((await params).school);
  const t = await getTranslations("SchoolNav");

  return (
    <>
      <SchoolHeader school={school} variant="site" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">{children}</main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <span>© {school.name}</span>
          <span>{t("poweredBy")}</span>
        </div>
      </footer>
    </>
  );
}
