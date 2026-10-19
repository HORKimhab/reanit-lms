import { SchoolHeader } from "@/components/shells/school-header";
import { getSiteSchool } from "@/server/schools/site";

/**
 * Signed-in student area shell: compact header, no marketing footer.
 *
 * @param props - Layout props.
 * @param props.children - The student page.
 * @param props.params - Route params with the school slug.
 * @returns The header and page.
 */
export default async function StudentLayout({ children, params }: LayoutProps<"/[locale]/s/[school]">) {
  const school = await getSiteSchool((await params).school);
  return (
    <>
      <SchoolHeader school={school} variant="student" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
