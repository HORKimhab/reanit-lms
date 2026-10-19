import { MAGIC_LINK_TTL_MS, type MailMessage } from "@reanit/core/auth";

/** Languages the magic-link email is written in; the web app's locales. */
export const EMAIL_LOCALES = ["en", "km"] as const;

/** A language the email can be sent in. */
type EmailLocale = (typeof EMAIL_LOCALES)[number];

/** Path on the web origin that reaches `GET /auth/magic-link/verify` through its `/api` rewrite (NEST-08). */
const MAGIC_LINK_VERIFY_PATH = "/api/auth/magic-link/verify";

const MINUTE_MS = 60 * 1000;

/** Subject and body per language; `{url}` and `{minutes}` are filled in. */
const MESSAGES: Record<EmailLocale, { subject: string; body: string }> = {
  en: {
    subject: "Your sign-in link",
    body: "Use this link to sign in:\n\n{url}\n\nIt expires in {minutes} minutes and works once. If you didn't ask for it, you can ignore this email.",
  },
  km: {
    subject: "តំណចូលគណនីរបស់អ្នក",
    body: "ប្រើតំណនេះដើម្បីចូលគណនី៖\n\n{url}\n\nតំណនេះផុតកំណត់ក្នុងរយៈពេល {minutes} នាទី ហើយប្រើបានតែម្តង។ ប្រសិនបើអ្នកមិនបានស្នើសុំទេ សូមមិនអើពើអ៊ីមែលនេះ។",
  },
};

/**
 * Writes the magic-link email around a fresh token.
 *
 * @param options Where the link points and in which language.
 * @param options.appUrl Public origin of the web app.
 * @param options.token Raw one-time token.
 * @param options.next Safe local path to land on after signing in.
 * @param options.locale Language of the email.
 * @returns Subject and body, without the recipient.
 */
export function composeMagicLinkEmail({
  appUrl,
  token,
  next,
  locale,
}: {
  appUrl: string;
  token: string;
  next: string;
  locale: EmailLocale;
}): Omit<MailMessage, "to"> {
  const url = new URL(MAGIC_LINK_VERIFY_PATH, appUrl);
  url.search = new URLSearchParams({ token, next }).toString();
  const { subject, body } = MESSAGES[locale];
  const text = body.replace("{url}", url.href).replace("{minutes}", String(MAGIC_LINK_TTL_MS / MINUTE_MS));
  return { subject, text };
}
