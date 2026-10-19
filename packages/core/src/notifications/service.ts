import type { Mailer } from "../auth";
import type { OrderPaid } from "../events";
import { ReceiptNotFoundError } from "./errors";
import type { PurchaseEmailComposer, ReceiptStore } from "./ports";
import { schoolPageUrl } from "./rules";

/** What `createPurchaseEmails` needs. */
export interface PurchaseEmailDependencies {
  /** Builds one school's receipt store; events name their school. */
  receiptsFor: (schoolId: string) => ReceiptStore;
  mailer: Mailer;
  composer: PurchaseEmailComposer;
  /** Public origin of the web app, for links. */
  appUrl: string;
}

/**
 * Builds the emails a purchase sends: a receipt, then a welcome for each course bought, in the
 * language the buyer checked out in.
 *
 * @param dependencies Receipt stores, mailer, composer and the web app's origin.
 * @param dependencies.receiptsFor Builds one school's receipt store.
 * @param dependencies.mailer Sends the emails.
 * @param dependencies.composer Writes them.
 * @param dependencies.appUrl Public origin of the web app.
 * @returns The purchase email operations.
 * @example
 * const purchaseEmails = createPurchaseEmails({ receiptsFor, mailer, composer, appUrl: env.APP_URL });
 * await purchaseEmails.sendForOrder(event);
 */
export function createPurchaseEmails({ receiptsFor, mailer, composer, appUrl }: PurchaseEmailDependencies) {
  return {
    /**
     * Emails the buyer of a paid order its receipt and a welcome to each course.
     *
     * @param event The `OrderPaid` event.
     * @param event.schoolId The school that sold the order.
     * @param event.payload The order.
     * @throws {ReceiptNotFoundError} When the school has no paid order with the event's id.
     */
    async sendForOrder({ schoolId, payload }: OrderPaid): Promise<void> {
      const receipt = await receiptsFor(schoolId).findReceipt(payload.orderId);
      if (!receipt) throw new ReceiptNotFoundError();
      const { locale, buyer, school } = receipt;
      const site = { appUrl, locale, subdomain: school.subdomain };

      await mailer.send({ to: buyer.email, ...(await composer.purchaseReceipt({ receipt, myCoursesUrl: schoolPageUrl({ ...site, path: "/my-courses" }) })) });
      for (const item of receipt.items) {
        const welcome = await composer.courseWelcome({
          locale,
          buyerName: buyer.name,
          schoolName: school.name,
          courseTitle: item.title,
          courseUrl: schoolPageUrl({ ...site, path: `/learn/${item.slug}` }),
        });
        await mailer.send({ to: buyer.email, ...welcome });
      }
    },
  };
}

/** The purchase email use cases. */
export type PurchaseEmails = ReturnType<typeof createPurchaseEmails>;
