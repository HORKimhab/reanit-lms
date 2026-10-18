import type { MockSchool } from "@/mocks/schools";
import { Link } from "@/i18n/navigation";

export function SchoolMark({ school }: { school: MockSchool }) {
  return (
    <Link href={`/s/${school.slug}`} className="flex items-center gap-2 font-semibold">
      <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground">
        {school.name.charAt(0)}
      </span>
      <span className="truncate">{school.name}</span>
    </Link>
  );
}
