import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RENEWAL_INTERVAL_MS, RenewalSweeper } from "./renewal.sweeper";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RenewalSweeper", () => {
  it("sweeps renewals every hour, logging only sweeps that did something", async () => {
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const sweep = vi.fn().mockResolvedValueOnce({ lapsed: 1, noticed: 2, reminded: 0 }).mockResolvedValue({ lapsed: 0, noticed: 0, reminded: 0 });
    const sweeper = new RenewalSweeper({ sweep });
    sweeper.onApplicationBootstrap();

    await vi.advanceTimersByTimeAsync(RENEWAL_INTERVAL_MS * 2);

    expect(sweep).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith("Renewals: 1 lapsed, 2 noticed, 0 reminded");
    expect(log).toHaveBeenCalledTimes(1);
    await sweeper.onApplicationShutdown();
  });
});
