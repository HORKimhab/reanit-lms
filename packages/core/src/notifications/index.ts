export { InvalidUnsubscribeLinkError, ReceiptNotFoundError } from "./errors";
export type {
  CommentNotice,
  CompletionNotice,
  ComposedEmail,
  NotificationPreferenceStore,
  OrderReceipt,
  PurchaseEmailComposer,
  ReceiptStore,
  RenewalEmailComposer,
  RenewalNotice,
  RenewalNoticeStore,
  StaffEmailBase,
  StaffEmailComposer,
  StaffNoticeStore,
  StaffRecipient,
} from "./ports";
export { createNotificationPreferences, type NotificationPreferenceService } from "./preferences";
export {
  DEFAULT_NOTIFICATION_PREFERENCES,
  EMAIL_LOCALES,
  NOTIFICATION_KINDS,
  NOTIFICATION_ROLES,
  notificationPreferencesSchema,
  schoolPageUrl,
  unsubscribeSchema,
  type EmailLocale,
  type NotificationKind,
  type NotificationPreferences,
  type UnsubscribeInput,
} from "./rules";
export { createRenewalEmails, type RenewalEmails } from "./renewals";
export { createPurchaseEmails, type PurchaseEmails } from "./service";
export { createStaffNotifications, type StaffNotifications } from "./staff";
