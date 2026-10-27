import { getTranslations } from "next-intl/server";

import { SchoolList } from "@/components/admin/school-list";
import { getPlatformSchools, schoolsQueryFrom } from "@/server/admin/console";

import { suspendSchool, unsuspendSchool } from "../actions";

/**
 * Every school on the platform, newest first, searchable and paged, with taking a school offline and back.
 *
 * @param props - Page props.
 * @param props.searchParams - `q` (name, subdomain or owner's email) and `page` (1-based).
 * @returns The page heading and the schools list.
 */
export default async function AdminSchools({ searchParams }: PageProps<"/[locale]/admin/schools">) {
  const query = schoolsQueryFrom(await searchParams);
  const [t, result] = await Promise.all([getTranslations("Admin.nav"), getPlatformSchools(query)]);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("schools")}</h1>
      <SchoolList result={result} q={query.q} suspend={suspendSchool} unsuspend={unsuspendSchool} />
    </div>
  );
}
