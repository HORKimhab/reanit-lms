import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EXPIRY_INTERVAL_MS, OrderExpirySweeper } from "./order-expiry.sweeper";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("OrderExpirySweeper", () => {
  it("fails abandoned orders every interval from boot until shutdown, logging how many", async () => {
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const expireStaleOrders = vi.fn().mockResolvedValueOnce(2).mockResolvedValue(0);
    const sweeper = new OrderExpirySweeper({ expireStaleOrders });
    sweeper.onApplicationBootstrap();

    await vi.advanceTimersByTimeAsync(EXPIRY_INTERVAL_MS * 2);
    expect(expireStaleOrders).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith("Failed 2 abandoned orders");
    expect(log).toHaveBeenCalledTimes(1);

    await sweeper.onApplicationShutdown();
    await vi.advanceTimersByTimeAsync(EXPIRY_INTERVAL_MS * 2);
    expect(expireStaleOrders).toHaveBeenCalledTimes(2);
  });

  it("logs a failed sweep and tries again on the next tick", async () => {
    const logError = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const expireStaleOrders = vi.fn().mockRejectedValueOnce(new Error("db down")).mockResolvedValue(0);
    const sweeper = new OrderExpirySweeper({ expireStaleOrders });
    sweeper.onApplicationBootstrap();

    await vi.advanceTimersByTimeAsync(EXPIRY_INTERVAL_MS * 2);

    expect(expireStaleOrders).toHaveBeenCalledTimes(2);
    expect(logError).toHaveBeenCalledWith(new Error("db down"), "Order expiry failed");
    await sweeper.onApplicationShutdown();
  });
});
