"use client";

import { suggestSubdomain } from "@reanit/core/schools";
import { Button } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import type * as React from "react";

import type { CreateSchoolState } from "@/app/[locale]/(auth)/onboarding/actions";
import { Field, INPUT_CLASS } from "@/components/form/field";

const INITIAL_STATE: CreateSchoolState = { status: "idle", invalidFields: [] };
const STEPS = ["name", "subdomain"] as const;

/** A wizard step, named after the field it asks for. */
type Step = (typeof STEPS)[number];

/**
 * Two-step create-school wizard: name, then subdomain (suggested from the name) with a
 * preview of the school's address. A rejected field sends the creator back to its step.
 *
 * @param props - Component props.
 * @param props.action - Creates the school; redirects on success.
 * @param props.rootDomain - Domain schools live under, for the address preview; omitted when unset.
 * @returns The wizard form.
 */
export function CreateSchoolWizard({
  action,
  rootDomain,
}: {
  action: (state: CreateSchoolState, formData: FormData) => Promise<CreateSchoolState>;
  rootDomain?: string;
}) {
  const t = useTranslations("Onboarding");
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [isSubdomainEdited, setIsSubdomainEdited] = useState(false);

  // Show the first step with a rejected field.
  useEffect(() => {
    const rejected = STEPS.find((field) => state.invalidFields.includes(field));
    if (rejected) setStep(rejected);
  }, [state]);

  /**
   * Gives a field's error message from the last submit.
   *
   * @param field - The field.
   * @returns The message, or `undefined` when the field is valid.
   */
  function errorFor(field: Step) {
    if (!state.invalidFields.includes(field)) return undefined;
    return field === "subdomain" && state.status === "subdomainTaken" ? t("errors.subdomainTaken") : t(`errors.${field}`);
  }

  /** Moves to the subdomain step, suggesting one from the name unless the creator typed their own. */
  function goToSubdomain() {
    if (!isSubdomainEdited) setSubdomain(suggestSubdomain(name));
    setStep("subdomain");
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {t("step", { current: STEPS.indexOf(step) + 1, total: STEPS.length })}
      </p>
      {step === "name" ? (
        <>
          <Field label={t("name")} hint={t("nameHint")} error={errorFor("name")}>
            {(control) => (
              <input
                {...control}
                name="name"
                required
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={INPUT_CLASS}
              />
            )}
          </Field>
          <Button type="button" onClick={goToSubdomain} disabled={!name.trim()}>
            {t("next")}
          </Button>
        </>
      ) : (
        <>
          <input type="hidden" name="name" value={name} />
          <Field label={t("subdomain")} hint={t("subdomainHint")} error={errorFor("subdomain")}>
            {(control) => (
              <input
                {...control}
                name="subdomain"
                required
                autoFocus
                autoCapitalize="none"
                spellCheck={false}
                value={subdomain}
                onChange={(event) => {
                  setSubdomain(event.target.value);
                  setIsSubdomainEdited(true);
                }}
                className={INPUT_CLASS}
              />
            )}
          </Field>
          {rootDomain && subdomain ? (
            <p className="text-sm text-muted-foreground">
              {t.rich("preview", { address: `${subdomain.trim().toLowerCase()}.${rootDomain}`, b: emphasize })}
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setStep("name")}>
              {t("back")}
            </Button>
            <Button type="submit" className="flex-1" disabled={isPending || !subdomain.trim()}>
              {isPending ? t("submitting") : t("submit")}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}

/**
 * Highlights the address inside the preview sentence.
 *
 * @param chunks - The tagged part of the message.
 * @returns The highlighted text.
 */
function emphasize(chunks: React.ReactNode) {
  return <span className="font-medium text-foreground">{chunks}</span>;
}
