import type { MailMessage } from "../auth";
import type { Currency } from "../commerce";
import type { EmailLocale } from "./rules";

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
