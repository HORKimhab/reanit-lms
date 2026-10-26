import { beforeEach, describe, expect, it } from "vitest";

import type { OrderPaid } from "../events";
import { FakeMailer } from "../test/auth-fakes";
import { FakeComposer, FakeReceiptStore, TEST_RECEIPT } from "../test/notification-fakes";
import { ReceiptNotFoundError } from "./errors";
import { createPurchaseEmails, type PurchaseEmails } from "./service";

const EVENT: OrderPaid = { type: "OrderPaid", schoolId: "school-1", payload: { orderId: "order-1", userId: "user-1", courseIds: ["c-1", "c-2"] } };

let receipts: FakeReceiptStore;
let mailer: FakeMailer;
let askedSchools: string[];
let emails: PurchaseEmails;

/**
 * Hands out the test's receipt store, recording which school asked.
 *
 * @param schoolId The event's school.
 * @returns The fake store.
 */
function receiptsFor(schoolId: string) {
  askedSchools.push(schoolId);
  return receipts;
}

beforeEach(() => {
  receipts = new FakeReceiptStore();
  mailer = new FakeMailer();
  askedSchools = [];
  emails = createPurchaseEmails({
    receiptsFor,
    mailer,
    composer: new FakeComposer(),
    appUrl: "https://reanit.com",
  });
});

describe("sendForOrder", () => {
  it("emails the buyer the receipt, then a welcome to each course, in their language with links to the school", async () => {
    receipts.receipts.set("order-1", TEST_RECEIPT);

    await emails.sendForOrder(EVENT);

    expect(askedSchools).toEqual(["school-1"]);
    expect(mailer.sent).toEqual([
      { to: "sokha@example.com", subject: "Receipt order-1 (km)", text: "https://reanit.com/km/s/angkor/my-courses" },
      { to: "sokha@example.com", subject: "Welcome to Brand (km)", text: "https://reanit.com/km/s/angkor/learn/brand" },
      { to: "sokha@example.com", subject: "Welcome to Social (km)", text: "https://reanit.com/km/s/angkor/learn/social" },
    ]);
  });

  it("throws ReceiptNotFoundError and sends nothing when the school has no such paid order", async () => {
    await expect(emails.sendForOrder(EVENT)).rejects.toThrow(ReceiptNotFoundError);
    expect(mailer.sent).toEqual([]);
  });
});
