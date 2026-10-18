import { Link } from "@/i18n/navigation";
import type { MockSchool } from "@/mocks/schools";

/**
 * School logo mark and name, linking to the school's home page.
 *
 * @param props - Component props.
 * @param props.school - The school to show.
 * @returns A link with the school's initial in its brand color and its name.
 */
export function SchoolMark({ school }: { school: MockSchool }) {
  return (
    <Link href={`/s/${school.slug}`} className="flex items-center gap-2 font-semibold">
      <span
        aria-hidden
        className="flex size-8 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground"
      >
        {school.name.charAt(0)}
      </span>
      <span className="truncate">{school.name}</span>
    </Link>
  );
}
