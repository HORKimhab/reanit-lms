import type { OutboxEvent } from "@reanit/core/events";
import { describe, expect, it, vi } from "vitest";

import { ORDER_PAID } from "../test/events";
import { dispatchEvent, toEventJobs } from "./event-job";

const COMPLETED: OutboxEvent = { ...ORDER_PAID, type: "CourseCompleted", payload: { enrollmentId: "e-1", courseId: "c-1" } };

describe("toEventJobs", () => {
  it("makes one job per handler of the event's type, named and identified by the event and the handler", () => {
    const handlers = { OrderPaid: { receipt: vi.fn(), saleNotice: vi.fn() }, CourseCompleted: { certificate: vi.fn() } };

    expect(toEventJobs(handlers, ORDER_PAID)).toEqual([
      { name: "OrderPaid.receipt", data: { ...ORDER_PAID, occurredAt: "2026-10-19T08:00:00.000Z", handler: "receipt" }, jobId: `${ORDER_PAID.id}.receipt` },
      { name: "OrderPaid.saleNotice", data: { ...ORDER_PAID, occurredAt: "2026-10-19T08:00:00.000Z", handler: "saleNotice" }, jobId: `${ORDER_PAID.id}.saleNotice` },
    ]);
  });

  it("makes no job for a type without handlers", () => {
    expect(toEventJobs({ CourseCompleted: { certificate: vi.fn() } }, ORDER_PAID)).toEqual([]);
  });
});

describe("dispatchEvent", () => {
  it("runs only the handler the job names, with the event's time as a date", async () => {
    const handlers = { OrderPaid: { receipt: vi.fn(), saleNotice: vi.fn().mockResolvedValue(undefined) } };
    const [, saleNoticeJob] = toEventJobs(handlers, ORDER_PAID);

    await dispatchEvent(handlers, saleNoticeJob!.data); // OrderPaid has two handlers, so there are two jobs

    expect(handlers.OrderPaid.saleNotice).toHaveBeenCalledWith(ORDER_PAID);
    expect(handlers.OrderPaid.receipt).not.toHaveBeenCalled();
  });

  it("routes CourseCompleted to its own handlers", async () => {
    const handlers = { OrderPaid: { receipt: vi.fn() }, CourseCompleted: { certificate: vi.fn().mockResolvedValue(undefined) } };
    const [job] = toEventJobs(handlers, COMPLETED);

    await dispatchEvent(handlers, job!.data); // CourseCompleted has a handler, so there is a job

    expect(handlers.CourseCompleted.certificate).toHaveBeenCalledWith(COMPLETED);
    expect(handlers.OrderPaid.receipt).not.toHaveBeenCalled();
  });

  it("does nothing for a handler that is no longer registered", async () => {
    const job = { ...ORDER_PAID, occurredAt: "2026-10-19T08:00:00.000Z", handler: "retired" };

    await expect(dispatchEvent({ OrderPaid: { receipt: vi.fn() } }, job)).resolves.toBeUndefined();
  });

  it("passes a handler's failure on, so the queue retries", async () => {
    const handlers = { OrderPaid: { receipt: vi.fn().mockRejectedValue(new Error("mail down")) } };
    const [job] = toEventJobs(handlers, ORDER_PAID);

    await expect(dispatchEvent(handlers, job!.data)).rejects.toThrow("mail down"); // OrderPaid has a handler, so there is a job
  });
});
