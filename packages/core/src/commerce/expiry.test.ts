import { describe, expect, it } from "vitest";

import { FakeClock } from "../test/auth-fakes";
import { FakeOrderExpiryStore } from "../test/commerce-fakes";
import { createOrderExpiry } from "./expiry";

const NOW = new Date("2026-10-26T12:00:00Z");

describe("expireStaleOrders", () => {
  it("fails pending orders past each gateway's window plus an hour's grace", async () => {
    const store = new FakeOrderExpiryStore();
    store.failed = 3;

    expect(await createOrderExpiry({ store, clock: new FakeClock(NOW) }).expireStaleOrders()).toBe(3);
    expect(store.lastCutoffs).toEqual({
      bakong_khqr: new Date("2026-10-26T10:45:00Z"),
      stripe: new Date("2026-10-25T11:00:00Z"),
      aba_payway: new Date("2026-10-25T11:00:00Z"),
    });
  });
});
