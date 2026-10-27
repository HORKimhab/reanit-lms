import { describe, expect, it } from "vitest";

import { FakeClock } from "../test/auth-fakes";
import { FakePayoutAdminStore, FakePayoutStore } from "../test/payout-fakes";
import { PayoutExceedsBalanceError } from "./errors";
import { createPayoutAdmin, createPayouts, nextPayoutDate, payoutAccountSchema, recordPayoutSchema } from "./payouts";

const NOW = new Date("2026-10-27T12:00:00Z");
const ANGKOR = { id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a10", name: "Angkor Academy", subdomain: "angkor" };
const ACCOUNT = { holderName: "Sokha Chan", bankName: "ABA Bank", account: "000 123 456" };

describe("nextPayoutDate", () => {
  it("is the 1st of next month, or today on the 1st", () => {
    expect(nextPayoutDate(NOW)).toEqual(new Date("2026-11-01T00:00:00Z"));
    expect(nextPayoutDate(new Date("2026-12-15T00:00:00Z"))).toEqual(new Date("2027-01-01T00:00:00Z"));
    expect(nextPayoutDate(new Date("2026-11-01T18:00:00Z"))).toEqual(new Date("2026-11-01T00:00:00Z"));
  });
});

describe("getBalance", () => {
  it("reads the balances with sales held for a week, the next payout date and the minimums", async () => {
    const store = new FakePayoutStore();
    store.balanceRows = [{ currency: "USD", available: 4655, onHold: 2450 }];

    expect(await createPayouts({ store, clock: new FakeClock(NOW) }).getBalance()).toEqual({
      balances: [{ currency: "USD", available: 4655, onHold: 2450 }],
      nextPayoutDate: new Date("2026-11-01T00:00:00Z"),
      minimums: { USD: 1000, KHR: 4_000_000 },
    });
    expect(store.lastCutoff).toEqual(new Date("2026-10-20T12:00:00Z"));
  });
});

describe("payout details", () => {
  it("saves and reads where payouts are sent, trimmed", async () => {
    const payouts = createPayouts({ store: new FakePayoutStore(), clock: new FakeClock(NOW) });

    await payouts.saveAccount(payoutAccountSchema.parse({ holderName: " Sokha Chan ", bankName: "ABA Bank", account: "000 123 456" }));

    expect(await payouts.getAccount()).toEqual(ACCOUNT);
  });

  it.each([{ holderName: "", bankName: "ABA", account: "1" }, { holderName: "Sokha", bankName: "ABA", account: "" }])("refuses %j", (input) => {
    expect(payoutAccountSchema.safeParse(input).success).toBe(false);
  });
});

describe("listDuePayouts", () => {
  it("lists each currency balance that reaches its minimum, with where to send it", async () => {
    const store = new FakePayoutAdminStore();
    store.schools = [
      { school: ANGKOR, account: ACCOUNT, balances: [{ currency: "USD", available: 1000, onHold: 0 }, { currency: "KHR", available: 3_999_900, onHold: 500_000 }] },
      { school: { ...ANGKOR, id: "school-2", subdomain: "bayon" }, account: null, balances: [{ currency: "USD", available: 5000, onHold: 0 }] },
      { school: { ...ANGKOR, id: "school-3", subdomain: "owes" }, account: null, balances: [{ currency: "USD", available: -490, onHold: 0 }] },
    ];

    const due = await createPayoutAdmin({ store, clock: new FakeClock(NOW) }).listDuePayouts();

    expect(due.map(({ school, currency, amount, account }) => [school.subdomain, currency, amount, account?.bankName ?? null])).toEqual([
      ["bayon", "USD", 5000, null],
      ["angkor", "USD", 1000, "ABA Bank"],
    ]);
  });
});

describe("recordPayout", () => {
  const PAYOUT = recordPayoutSchema.parse({ schoolId: ANGKOR.id, currency: "USD", amount: 4655, paidAt: "2026-11-01T09:00:00+07:00", reference: "ABA-TRX-1" });

  it("records a transfer within the available balance", async () => {
    const store = new FakePayoutAdminStore();
    store.schools = [{ school: ANGKOR, account: ACCOUNT, balances: [{ currency: "USD", available: 4655, onHold: 0 }] }];

    expect(await createPayoutAdmin({ store, clock: new FakeClock(NOW) }).recordPayout(PAYOUT, "admin-1")).toMatchObject({ amount: 4655, paidAt: new Date("2026-11-01T02:00:00Z") });
    expect(store.recorded[0]?.recordedById).toBe("admin-1");
  });

  it("refuses more than the available balance", async () => {
    const store = new FakePayoutAdminStore();
    store.schools = [{ school: ANGKOR, account: ACCOUNT, balances: [{ currency: "USD", available: 4654, onHold: 500 }] }];

    await expect(createPayoutAdmin({ store, clock: new FakeClock(NOW) }).recordPayout(PAYOUT, "admin-1")).rejects.toThrow(PayoutExceedsBalanceError);
  });

  it.each([{ amount: 0 }, { currency: "KHR", amount: 150 }, { reference: " " }])("refuses %j", (change) => {
    expect(recordPayoutSchema.safeParse({ schoolId: ANGKOR.id, currency: "USD", amount: 100, paidAt: "2026-11-01T09:00:00Z", reference: "x", ...change }).success).toBe(false);
  });
});
