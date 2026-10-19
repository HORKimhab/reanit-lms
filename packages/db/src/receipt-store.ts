import type { DbClient } from "./client";
import { forSchool } from "./tenant";

/** Currencies courses are sold in; matches `Currency` in `@reanit/core/commerce`. */
type Currency = "USD" | "KHR";
/** Languages emails are written in; matches `EmailLocale` in `@reanit/core/notifications`. */
type EmailLocale = "en" | "km";

/**
 * One school's paid orders as their emails show them. Reads go through the tenant client, so
 * another school's orders are invisible; it satisfies `ReceiptStore` from `@reanit/core/notifications`.
 *
 * @param db Unscoped client from `createDbClient`.
 * @param schoolId The school that sold the orders.
 * @returns The store operations.
 * @throws {z.ZodError} When `schoolId` is not a UUID.
 * @example
 * createPurchaseEmails({ receiptsFor: (schoolId) => createReceiptStore(db, schoolId), mailer, composer, appUrl });
 */
export function createReceiptStore(db: DbClient, schoolId: string) {
  const tenant = forSchool(db, schoolId);

  return {
    /**
     * Loads a paid order with its buyer, school and courses.
     *
     * @param orderId The order.
     * @returns The receipt, or null when the school has no paid order with that id.
     */
    async findReceipt(orderId: string) {
      const order = await tenant.order.findFirst({
        where: { id: orderId, status: "paid", paidAt: { not: null } },
        select: {
          id: true,
          locale: true,
          paidAt: true,
          totalAmount: true,
          currency: true,
          user: { select: { email: true, name: true } },
          school: { select: { name: true, subdomain: true } },
          items: { select: { amount: true, currency: true, course: { select: { title: true, slug: true } } } },
        },
      });
      if (!order?.paidAt) return null;
      return {
        orderId: order.id,
        locale: order.locale as EmailLocale,
        paidAt: order.paidAt,
        buyer: order.user,
        school: order.school,
        items: order.items.map(({ amount, currency, course }) => ({ ...course, amount, currency: currency as Currency })),
        total: { amount: order.totalAmount, currency: order.currency as Currency },
      };
    },
  };
}
