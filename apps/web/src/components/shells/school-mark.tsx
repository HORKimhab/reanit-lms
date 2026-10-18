import { Link } from "@/i18n/navigation";
import type { MockSchool } from "@/mocks/schools";

import { SchoolLogo } from "./school-logo";

/**
 * School logo mark and name, linking to the school's home page.
 *
 * @param props - Component props.
 * @param props.school - The school to show.
 * @returns A link with the school's logo and its name.
 */
export function SchoolMark({ school }: { school: MockSchool }) {
  return (
    <Link href={`/s/${school.slug}`} className="flex items-center gap-2 font-semibold">
      <SchoolLogo name={school.name} logoUrl={school.logoUrl} />
      <span className="truncate">{school.name}</span>
    </Link>
  );
}
