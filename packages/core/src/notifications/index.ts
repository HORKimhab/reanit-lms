export { ReceiptNotFoundError } from "./errors";
export type { ComposedEmail, OrderReceipt, PurchaseEmailComposer, ReceiptStore } from "./ports";
export { EMAIL_LOCALES, schoolPageUrl, type EmailLocale } from "./rules";
export { createPurchaseEmails, type PurchaseEmails } from "./service";
