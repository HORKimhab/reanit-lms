import { getTranslations } from "next-intl/server";

import { SettingsForm } from "@/components/settings/settings-form";
import { getStaffSchool } from "@/server/schools/staff";

import { saveSchoolSettings, startLogoUpload } from "./actions";

/** Roles that may change the school's settings; the API refuses instructors. */
const SETTINGS_ROLES = new Set(["owner", "admin"]);

/**
 * School settings: name, brand color and logo with a live preview. Instructors see why they cannot edit them.
 *
 * @returns The page heading and the settings form, or a notice for instructors.
 */
export default async function DashboardSettings() {
  const [t, nav, { school, role }] = await Promise.all([getTranslations("Settings"), getTranslations("DashboardNav"), getStaffSchool()]);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{nav("settings")}</h1>
      {SETTINGS_ROLES.has(role) ? (
        <SettingsForm school={school} actions={{ save: saveSchoolSettings, startLogoUpload }} />
      ) : (
        <p className="text-sm text-muted-foreground">{t("staffOnly")}</p>
      )}
    </div>
  );
}
