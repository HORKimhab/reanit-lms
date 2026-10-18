import { useTranslations } from "next-intl";

import type { MockSchool } from "@/mocks/schools";

/**
 * Public school site footer: the school's copyright and the platform credit.
 *
 * @param props - Component props.
 * @param props.school - The school whose name to show.
 * @returns The footer.
 */
export function SchoolFooter({ school }: { school: MockSchool }) {
  const t = useTranslations("SchoolNav");
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <span>© {school.name}</span>
        <span>{t("poweredBy")}</span>
      </div>
    </footer>
  );
}
