import { NOTIFICATION_KINDS, NOTIFICATION_ROLES } from "@reanit/core/notifications";
import { getTranslations } from "next-intl/server";

import { CertificateTemplateForm } from "@/components/settings/certificate-template-form";
import { CustomDomainSection } from "@/components/settings/custom-domain-section";
import { NotificationPreferencesForm } from "@/components/settings/notification-preferences-form";
import { PaymentQrForm } from "@/components/settings/payment-qr-form";
import { SettingsForm } from "@/components/settings/settings-form";
import { TeamSection } from "@/components/settings/team-section";
import { getCertificateTemplate } from "@/server/learning/certificates";
import { getNotificationPreferences } from "@/server/notifications/preferences";
import { getCustomDomainSettings } from "@/server/schools/domain-settings";
import { canManageSchool, getStaffSchool } from "@/server/schools/staff";
import { getTeam } from "@/server/schools/team";

import {
  addCustomDomain,
  changeTeamRole,
  inviteTeamMember,
  removeCustomDomain,
  removeTeamMember,
  savePaymentQr,
  saveCertificateTemplate,
  saveNotificationPreferences,
  saveSchoolSettings,
  startImageUpload,
  verifyCustomDomain,
} from "./actions";

/**
 * School settings: name, brand color and logo with a live preview, the payment QR students scan to pay
 * offline, who signs certificates, the custom domain and the team, which instructors see why they cannot edit; then every staff member's own email settings.
 *
 * @returns The page heading, the settings forms and team (or a notice for instructors) and the email settings.
 */
export default async function DashboardSettings() {
  const [t, nav, { school, role }] = await Promise.all([getTranslations("Settings"), getTranslations("DashboardNav"), getStaffSchool()]);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{nav("settings")}</h1>
      {canManageSchool(role) ? (
        <>
          <SettingsForm school={school} actions={{ save: saveSchoolSettings, startLogoUpload: startImageUpload.bind(null, "logo") }} />
          <PaymentQrForm qrUrl={school.paymentQrUrl} actions={{ save: savePaymentQr, startUpload: startImageUpload.bind(null, "payment-qr") }} />
          <CertificateTemplateForm template={await getCertificateTemplate()} save={saveCertificateTemplate} />
          <CustomDomainSection
            settings={await getCustomDomainSettings()}
            actions={{ add: addCustomDomain, verify: verifyCustomDomain, remove: removeCustomDomain }}
          />
          <TeamSection team={await getTeam()} now={new Date()} actions={{ invite: inviteTeamMember, changeRole: changeTeamRole, remove: removeTeamMember }} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("staffOnly")}</p>
      )}
      <NotificationPreferencesForm
        preferences={await getNotificationPreferences()}
        kinds={NOTIFICATION_KINDS.filter((kind) => NOTIFICATION_ROLES[kind].includes(role))}
        save={saveNotificationPreferences}
      />
    </div>
  );
}
