// Fakes of the notifications ports, for unit tests of the purchase emails.
import type { ComposedEmail, OrderReceipt, PurchaseEmailComposer, ReceiptStore } from "../notifications";

/** In-memory `ReceiptStore` for one school. */
export class FakeReceiptStore implements ReceiptStore {
  readonly receipts = new Map<string, OrderReceipt>();

  /**
   * Finds a stored receipt.
   *
   * @param orderId The order.
   * @returns The receipt, or null.
   */
  async findReceipt(orderId: string) {
    return this.receipts.get(orderId) ?? null;
  }
}

/** Composer whose emails name what they were written from, so tests can check what was sent. */
export class FakeComposer implements PurchaseEmailComposer {
  /**
   * Writes a receipt naming the order, its language and the link.
   *
   * @param email The receipt and the My courses link.
   * @param email.receipt The receipt.
   * @param email.myCoursesUrl The link.
   * @returns The email.
   */
  async purchaseReceipt({ receipt, myCoursesUrl }: { receipt: OrderReceipt; myCoursesUrl: string }): Promise<ComposedEmail> {
    return { subject: `Receipt ${receipt.orderId} (${receipt.locale})`, text: myCoursesUrl };
  }

  /**
   * Writes a welcome naming the course, its language and the link.
   *
   * @param email The course and the link.
   * @param email.locale The language.
   * @param email.courseTitle The course.
   * @param email.courseUrl The link.
   * @returns The email.
   */
  async courseWelcome({ locale, courseTitle, courseUrl }: { locale: string; courseTitle: string; courseUrl: string }): Promise<ComposedEmail> {
    return { subject: `Welcome to ${courseTitle} (${locale})`, text: courseUrl };
  }
}
