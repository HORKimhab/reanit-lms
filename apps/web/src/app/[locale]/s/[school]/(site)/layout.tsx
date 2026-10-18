import { SchoolFooter } from "@/components/shells/school-footer";
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
  return (
    <>
      <SchoolHeader school={school} variant="site" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">{children}</main>
      <SchoolFooter school={school} />
    </>
  );
}
