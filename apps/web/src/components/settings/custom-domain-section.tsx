"use client";

import { DOMAIN_HOSTNAME_MAX_LENGTH, type CustomDomain } from "@reanit/core/schools";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import type { CustomDomainState } from "@/app/[locale]/dashboard/settings/actions";
import { ConfirmButton } from "@/components/form/confirm-button";
import { Field, INPUT_CLASS } from "@/components/form/field";
import { SubmitRow } from "@/components/form/submit-row";
import type { CustomDomainSettings } from "@/server/schools/domain-settings";

const INITIAL_STATE: CustomDomainState = { status: "idle" };

/** A step of the custom domain setup, as a form action. */
type DomainStep = (state: CustomDomainState, formData: FormData) => Promise<CustomDomainState>;

/** The server actions the section runs. */
type DomainActions = { add: DomainStep; verify: DomainStep; remove: () => Promise<void> };

/**
 * Says why the last step failed, or nothing when it worked.
 *
 * @param state The step's last result.
 * @returns The error's message key under `CustomDomain.errors`, or undefined.
 */
function errorKey(state: CustomDomainState): Exclude<CustomDomainState["status"], "idle"> | undefined {
  return state.status === "idle" ? undefined : state.status;
}

/**
 * The form that starts setting up a domain.
 *
 * @param props - Component props.
 * @param props.add - Adds the domain.
 * @returns The hostname field and its submit button.
 */
function AddDomainForm({ add }: { add: DomainStep }) {
  const t = useTranslations("CustomDomain");
  const [state, formAction, isPending] = useActionState(add, INITIAL_STATE);
  const error = errorKey(state);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label={t("hostname")} hint={t("hostnameHint")} error={error && t(`errors.${error}`)}>
        {(control) => (
          <input {...control} name="hostname" required maxLength={DOMAIN_HOSTNAME_MAX_LENGTH} autoComplete="off" spellCheck={false} className={INPUT_CLASS} />
        )}
      </Field>
      <SubmitRow label={t("add")} pendingLabel={t("adding")} isPending={isPending} />
    </form>
  );
}

/**
 * The school's domain: where its setup stands, the DNS records to add, and the check and remove buttons.
 *
 * @param props - Component props.
 * @param props.domain - The school's domain.
 * @param props.actions - Checks the records and removes the domain.
 * @returns The domain's status, records and buttons.
 */
function DomainDetails({ domain, actions }: { domain: CustomDomain; actions: DomainActions }) {
  const t = useTranslations("CustomDomain");
  const [state, formAction, isPending] = useActionState(actions.verify, INITIAL_STATE);
  const error = errorKey(state);
  const isChecking = domain.status === "awaiting_dns" || domain.status === "issuing_certificate";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="font-medium break-all">{domain.hostname}</p>
        <p className="text-sm text-muted-foreground">{t(`status.${domain.status}`)}</p>
      </div>
      <table className="w-full text-left text-sm">
        <caption className="pb-2 text-left text-sm text-muted-foreground">{t("recordsCaption")}</caption>
        <thead>
          <tr className="border-b">
            <th scope="col" className="py-2 pr-4 font-medium">
              {t("recordType")}
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              {t("recordName")}
            </th>
            <th scope="col" className="py-2 font-medium">
              {t("recordValue")}
            </th>
          </tr>
        </thead>
        <tbody>
          {domain.dnsRecords.map((record) => (
            <tr key={record.type} className="border-b align-top">
              <td className="py-2 pr-4">{record.type}</td>
              <td className="py-2 pr-4 font-mono break-all select-all">{record.name}</td>
              <td className="py-2 font-mono break-all select-all">{record.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {isChecking ? (
        <form action={formAction} className="flex flex-col gap-2">
          <SubmitRow label={t("check")} pendingLabel={t("checking")} isPending={isPending} />
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {t(`errors.${error}`)}
            </p>
          ) : null}
        </form>
      ) : null}
      <ConfirmButton
        action={actions.remove}
        labels={{ trigger: t("remove"), warning: t("removeWarning"), confirm: t("confirmRemove"), pending: t("removing"), cancel: t("cancel") }}
      />
    </div>
  );
}

/**
 * Custom domain settings: serve the school site on the owner's own domain once its DNS records prove they own it.
 *
 * @param props - Component props.
 * @param props.settings - Whether custom domains are offered, and the school's domain.
 * @param props.actions - Adds, checks and removes the domain.
 * @returns The custom domain section of the settings page.
 */
export function CustomDomainSection({ settings, actions }: { settings: CustomDomainSettings; actions: DomainActions }) {
  const t = useTranslations("CustomDomain");

  return (
    <section aria-labelledby="custom-domain" className="flex max-w-xl flex-col gap-4 border-t pt-8">
      <div className="flex flex-col gap-1">
        <h2 id="custom-domain" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      {!settings.isAvailable ? (
        <p className="text-sm text-muted-foreground">{t("errors.unavailable")}</p>
      ) : settings.domain ? (
        <DomainDetails domain={settings.domain} actions={actions} />
      ) : (
        <AddDomainForm add={actions.add} />
      )}
    </section>
  );
}
