import type { PayoutAccount } from "@reanit/core/commerce";
import { useTranslations } from "next-intl";

import { SettingsSection } from "@/components/settings/settings-section";

/**
 * Where the school's payouts are sent, read-only, for admins: only the owner changes it.
 *
 * @param props - Component props.
 * @param props.account - The saved details, or null when the owner has not added them.
 * @returns The payout details section.
 */
export function PayoutAccountSummary({ account }: { account: PayoutAccount | null }) {
  const t = useTranslations("Payouts");

  return (
    <SettingsSection id="payout-account" title={t("accountTitle")} intro={t("ownerOnly")}>
      {account ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t("holderName")}</dt>
          <dd>{account.holderName}</dd>
          <dt className="text-muted-foreground">{t("bankName")}</dt>
          <dd>{account.bankName}</dd>
          <dt className="text-muted-foreground">{t("account")}</dt>
          <dd className="font-mono">{account.account}</dd>
        </dl>
      ) : (
        <p className="text-sm">{t("noAccount")}</p>
      )}
    </SettingsSection>
  );
}
