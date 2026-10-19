"use client";

import { Button } from "@reanit/ui/components/button";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

/**
 * Posts the gateway's signed fields from the browser to its hosted page (PayWay), straight away;
 * the button is there for when the automatic submit is blocked.
 *
 * @param props - Component props.
 * @param props.action - The gateway's checkout URL.
 * @param props.fields - The signed fields to post.
 * @returns A form of hidden fields with a continue button.
 */
export function GatewayForm({ action, fields }: { action: string; fields: Record<string, string> }) {
  const t = useTranslations("Checkout");
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    ref.current?.submit();
  }, []);

  return (
    <form ref={ref} method="post" action={action} className="flex flex-col gap-3">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <p role="status" className="text-sm text-muted-foreground">
        {t("toGateway")}
      </p>
      <Button type="submit" className="self-start">
        {t("continue")}
      </Button>
    </form>
  );
}
