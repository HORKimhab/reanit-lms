import type { MailMessage } from "../auth";
import type { Billing, Currency, SubscriptionStatus } from "../commerce";
import type { MembershipRole } from "../schools";
import type { EmailLocale, NotificationKind, NotificationPreferences } from "./rules";

/** A paid order as its receipt and welcome emails show it. */
export interface OrderReceipt {
  orderId: string;
  /** The language the buyer checked out in. */
  locale: EmailLocale;
  paidAt: Date;
  buyer: { email: string; name: string | null };
  school: { name: string; subdomain: string };
  /** What was bought, each at the price paid in integer minor units. */
  items: { title: string; slug: string; amount: number; currency: Currency }[];
  total: { amount: number; currency: Currency };
}

/** One school's paid orders, for their emails. `@reanit/db` implements it with `createReceiptStore`. */
export interface ReceiptStore {
  /** The order's receipt, or null when the school has no paid order with that id. */
  findReceipt(orderId: string): Promise<OrderReceipt | null>;
}

/** An email's subject and bodies, ready to address. */
export type ComposedEmail = Omit<MailMessage, "to">;

/** Writes the purchase emails in the buyer's language. `@reanit/email` implements it with React Email templates. */
export interface PurchaseEmailComposer {
  purchaseReceipt(email: { receipt: OrderReceipt; myCoursesUrl: string }): Promise<ComposedEmail>;
  courseWelcome(email: { locale: EmailLocale; buyerName: string | null; schoolName: string; courseTitle: string; courseUrl: string }): Promise<ComposedEmail>;
}

/** A staff member a staff email goes to. */
export interface StaffRecipient {
  email: string;
  name: string | null;
  /** The language their emails are written in. */
  locale: EmailLocale;
  /** Their secret for this school's unsubscribe links. */
  unsubscribeToken: string;
}

/** A comment as the staff email about it describes it. */
export interface CommentNotice {
  /** Null when the author gave no name. */
  authorName: string | null;
  /** Whether the author runs the school; staff replies send no email. */
  isStaffAuthor: boolean;
  body: string;
  lessonTitle: string;
  courseTitle: string;
  schoolName: string;
}

/** A completed course as the staff email about it describes it. */
export interface CompletionNotice {
  studentName: string | null;
  studentEmail: string;
  courseTitle: string;
  schoolName: string;
}

/** One school's staff and what happened in it, for staff emails. `@reanit/db` implements it with `createStaffNoticeStore`. */
export interface StaffNoticeStore {
  /** Staff with one of `roles` who have not turned `kind` off; staff who never saved settings get the defaults first. */
  findRecipients(kind: NotificationKind, roles: readonly MembershipRole[]): Promise<StaffRecipient[]>;
  /** The comment, or null when the school no longer has it. */
  findComment(commentId: string): Promise<CommentNotice | null>;
  /** The completed enrollment, or null when the school no longer has it. */
  findCompletion(enrollmentId: string): Promise<CompletionNotice | null>;
}

/** Staff members' email settings. `@reanit/db` implements it with `createNotificationPreferenceStore`. */
export interface NotificationPreferenceStore {
  /** The staff member's settings in the school, or null when they never saved any. */
  findPreferences(schoolId: string, userId: string): Promise<NotificationPreferences | null>;
  savePreferences(schoolId: string, userId: string, preferences: NotificationPreferences): Promise<NotificationPreferences>;
  /** Turns one kind off for whoever the token belongs to, in any school; that school's name, or null for an unknown token. */
  unsubscribe(token: string, kind: NotificationKind): Promise<{ schoolName: string } | null>;
}

/** What every staff email carries besides its news. */
export interface StaffEmailBase {
  locale: EmailLocale;
  schoolName: string;
  /** Stops this kind of email. */
  unsubscribeUrl: string;
  /** The dashboard's email settings. */
  preferencesUrl: string;
}

/** Writes the emails staff get about their school, in each reader's language. `@reanit/email` implements it with React Email templates. */
export interface StaffEmailComposer {
  newSale(
    email: StaffEmailBase & {
      buyer: { name: string | null; email: string };
      courseTitles: string[];
      total: { amount: number; currency: Currency };
      salesUrl: string;
    },
  ): Promise<ComposedEmail>;
  newComment(email: StaffEmailBase & Omit<CommentNotice, "isStaffAuthor" | "schoolName"> & { inboxUrl: string }): Promise<ComposedEmail>;
  courseCompleted(email: StaffEmailBase & Omit<CompletionNotice, "schoolName"> & { studentsUrl: string }): Promise<ComposedEmail>;
}

/** A subscription or payment plan as its renewal email describes it. */
export interface RenewalNotice {
  /** The language of the student's last order for it. */
  locale: EmailLocale;
  student: { email: string; name: string | null };
  school: { name: string; subdomain: string };
  /** The course's or bundle's title. */
  title: string;
  /** What the next period or instalment costs, in integer minor units. */
  price: { amount: number; currency: Currency };
  /** How it bills; never one-time. */
  billing: Exclude<Billing, { kind: "one_time" }>;
  /** Periods (or instalments) paid so far. */
  paidPeriods: number;
  status: SubscriptionStatus;
  /** The end of the last paid period. */
  currentPeriodEnd: Date;
}

/** One school's subscriptions, for renewal emails. `@reanit/db` implements it with `createRenewalNoticeStore`. */
export interface RenewalNoticeStore {
  /** The subscription as its email describes it, or null when the school no longer has it or it was never paid. */
  findRenewalNotice(subscriptionId: string): Promise<RenewalNotice | null>;
}

/** Writes renewal emails in the student's language. `@reanit/email` implements it with React Email templates. */
export interface RenewalEmailComposer {
  /** The email asking the student to pay the next period: the coming one, or on the grace period's last day. */
  renewalDue(email: { notice: RenewalNotice; isLastDay: boolean; accessUntil: Date; payUrl: string }): Promise<ComposedEmail>;
}
