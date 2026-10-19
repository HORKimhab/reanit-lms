import type { OutboxEvent } from "@reanit/core/events";
import { describe, expect, it, vi } from "vitest";

import { ORDER_PAID } from "../test/events";
import { dispatchEvent, toEventJob } from "./event-job";

describe("toEventJob", () => {
  it("keeps the event and writes its time as an ISO string", () => {
    expect(toEventJob(ORDER_PAID)).toEqual({ ...ORDER_PAID, occurredAt: "2026-10-19T08:00:00.000Z" });
  });
});

describe("dispatchEvent", () => {
  it("runs the handler of the event's type with the time as a date", async () => {
    const handlers = { OrderPaid: vi.fn().mockResolvedValue(undefined), CourseCompleted: vi.fn() };

    await dispatchEvent(handlers, toEventJob(ORDER_PAID));

    expect(handlers.OrderPaid).toHaveBeenCalledWith(ORDER_PAID);
    expect(handlers.CourseCompleted).not.toHaveBeenCalled();
  });

  it("routes CourseCompleted to its own handler", async () => {
    const completed: OutboxEvent = { ...ORDER_PAID, type: "CourseCompleted", payload: { enrollmentId: "e-1", courseId: "c-1" } };
    const handlers = { OrderPaid: vi.fn(), CourseCompleted: vi.fn().mockResolvedValue(undefined) };

    await dispatchEvent(handlers, toEventJob(completed));

    expect(handlers.CourseCompleted).toHaveBeenCalledWith(completed);
    expect(handlers.OrderPaid).not.toHaveBeenCalled();
  });

  it("does nothing for a type without a handler", async () => {
    await expect(dispatchEvent({}, toEventJob(ORDER_PAID))).resolves.toBeUndefined();
  });

  it("passes a handler's failure on, so the queue retries", async () => {
    await expect(dispatchEvent({ OrderPaid: vi.fn().mockRejectedValue(new Error("mail down")) }, toEventJob(ORDER_PAID))).rejects.toThrow(
      "mail down",
    );
  });
});
