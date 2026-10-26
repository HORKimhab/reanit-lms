import { beforeEach, describe, expect, it } from "vitest";

import type { SubscriptionRenewalDue } from "../events";
import { FakeMailer } from "../test/auth-fakes";
import { FakeRenewalComposer, FakeRenewalNoticeStore, TEST_RENEWAL } from "../test/notification-fakes";
import { createRenewalEmails, type RenewalEmails } from "./renewals";

/**
 * Builds the event for the test subscription.
 *
 * @param isLastDay Whether it is the grace period's last day.
 * @param periodEnd The period end it is about.
 * @returns The event.
 */
function event(isLastDay = false, periodEnd = "2026-11-01T09:00:00.000Z"): SubscriptionRenewalDue {
  return { type: "SubscriptionRenewalDue", schoolId: "school-1", payload: { subscriptionId: "sub-1", periodEnd, isLastDay } };
}

let store: FakeRenewalNoticeStore;
let mailer: FakeMailer;
let emails: RenewalEmails;

/**
 * Hands out the test's notice store for any school.
 *
 * @returns The fake store.
 */
function renewalsFor() {
  return store;
}

beforeEach(() => {
  store = new FakeRenewalNoticeStore();
  store.notices.set("sub-1", TEST_RENEWAL);
  mailer = new FakeMailer();
  emails = createRenewalEmails({ renewalsFor, mailer, composer: new FakeRenewalComposer(), appUrl: "https://reanit.com" });
});

describe("sendRenewalNotice", () => {
  it("emails the student, in their language, when access ends unpaid and a link to pay on their purchases page", async () => {
    await emails.sendRenewalNotice(event());

    expect(mailer.sent).toEqual([
      { to: "sokha@example.com", subject: "Renew Design Club (km)", text: "2026-11-08T09:00:00.000Z https://reanit.com/km/s/angkor/purchases" },
    ]);
  });

  it("writes the last-day reminder", async () => {
    await emails.sendRenewalNotice(event(true));

    expect(mailer.sent[0]?.subject).toBe("Last day Design Club (km)");
  });

  it.each([
    ["renewed meanwhile", event(false, "2026-10-01T09:00:00.000Z")],
    ["about another period", event(true, "2026-12-01T09:00:00.000Z")],
  ])("sends nothing for a notice %s", async (_case, stale) => {
    await emails.sendRenewalNotice(stale);

    expect(mailer.sent).toEqual([]);
  });

  it.each([{ ...TEST_RENEWAL, status: "lapsed" as const }, { ...TEST_RENEWAL, status: "completed" as const }])("sends nothing once the subscription is $status", async (notice) => {
    store.notices.set("sub-1", notice);

    await emails.sendRenewalNotice(event());

    expect(mailer.sent).toEqual([]);
  });

  it("sends nothing for a subscription the school no longer has", async () => {
    store.notices.clear();

    await emails.sendRenewalNotice(event());

    expect(mailer.sent).toEqual([]);
  });
});
