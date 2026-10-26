import { describe, expect, it } from "vitest";

import { FakeClock } from "../test/auth-fakes";
import { FakeRenewalSweepStore } from "../test/commerce-fakes";
import { createRenewalSweep } from "./renewals";

describe("sweep", () => {
  it("lapses subscriptions a week past their period, then notices those ending within 3 days, then reminds those on their grace period's last day", async () => {
    const store = new FakeRenewalSweepStore();
    store.counts = { lapsed: 1, noticed: 4, reminded: 2 };

    const result = await createRenewalSweep({ store, clock: new FakeClock(new Date("2026-10-27T12:00:00Z")) }).sweep();

    expect(result).toEqual({ lapsed: 1, noticed: 4, reminded: 2 });
    expect(store.calls).toEqual([
      ["lapse", new Date("2026-10-20T12:00:00Z")],
      ["notice", new Date("2026-10-30T12:00:00Z")],
      ["lastDay", new Date("2026-10-21T12:00:00Z")],
    ]);
  });
});
