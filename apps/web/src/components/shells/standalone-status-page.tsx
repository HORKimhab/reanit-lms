import { createTranslator } from "next-intl";
import type * as React from "react";

import en from "../../../messages/en.json";
import km from "../../../messages/km.json";

import { StatusPage } from "./status-page";

/** The page's wording in English and in Khmer: it shows before the visitor's language is known. */
const STATUS = [createTranslator({ locale: "en", messages: en, namespace: "Status" }), createTranslator({ locale: "km", messages: km, namespace: "Status" })];

/** What went wrong, with its status code. */
const KINDS = { notFound: { code: 404, title: "notFoundTitle", text: "notFoundText" }, error: { code: 500, title: "errorTitle", text: "errorText" } } as const;

/**
 * A whole document for a missing page or an error outside the localized layout (no locale, or the
 * layout itself failed), written in both languages.
 *
 * @param props - Component props.
 * @param props.kind - `notFound` (404) or `error` (500).
 * @param props.children - Actions, such as a retry button.
 * @returns The `<html>` document.
 */
export function StandaloneStatusPage({ kind, children }: { kind: keyof typeof KINDS; children?: React.ReactNode }) {
  const { code, title, text } = KINDS[kind];
  return (
    <html lang="en">
      <body>
        <StatusPage code={code} title={STATUS.map((t) => t(title)).join(" · ")} text={STATUS.map((t) => t(text)).join(" ")}>
          {children}
        </StatusPage>
      </body>
    </html>
  );
}

/**
 * The same label in both languages, for actions on a standalone status page.
 *
 * @param key - The `Status` message.
 * @returns English, then Khmer.
 */
export function bilingual(key: "retry" | "home"): string {
  return STATUS.map((t) => t(key)).join(" · ");
}
