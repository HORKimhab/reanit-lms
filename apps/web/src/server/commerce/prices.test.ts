// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { formData as form } from "@/test/form";
import { NotFoundError } from "@/test/navigation";
import { signIn } from "@/test/session";

import { getCoursePrice, priceFrom } from "./prices";

vi.mock("next/headers", () => import("@/test/headers"));

const COURSE_ID = "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a01";

describe("priceFrom", () => {
  it("reads a one-time price, in minor units of its currency", () => {
    expect(priceFrom(form({ amount: "120,000", currency: "KHR", billing: "one_time" }))).toEqual({
      status: "valid",
      price: { amount: 12_000_000, currency: "KHR", billing: { kind: "one_time" } },
    });
  });

  it("reads a subscription and a payment plan", () => {
    expect(priceFrom(form({ amount: "15", currency: "USD", billing: "recurring", interval: "year" }))).toMatchObject({ price: { billing: { kind: "recurring", interval: "year" } } });
    expect(priceFrom(form({ amount: "25", currency: "USD", billing: "payment_plan", installments: "4" }))).toMatchObject({ price: { billing: { kind: "payment_plan", installments: 4 } } });
  });

  it.each([
    ["no amount", { amount: "", currency: "USD" }, ["amount"]],
    ["an unknown currency", { amount: "10", currency: "EUR" }, ["amount"]],
    ["too many payments", { amount: "10", currency: "USD", billing: "payment_plan", installments: "30" }, ["installments"]],
    ["an unknown period", { amount: "10", currency: "USD", billing: "recurring", interval: "week" }, ["installments"]],
  ])("reports %s", (_case, fields, invalidFields) => {
    expect(priceFrom(form(fields))).toEqual({ status: "invalid", invalidFields });
  });
});

describe("getCoursePrice", () => {
  it("returns the course's price, or null before one is set", async () => {
    signIn();
    const price = { amount: 1500, currency: "USD", billing: { kind: "one_time" } };
    onApi(`GET /courses/${COURSE_ID}/price`, Response.json({ price }));

    expect(await getCoursePrice(COURSE_ID)).toEqual(price);
  });

  it("is not found for a course the school does not have", async () => {
    signIn();
    onApi(`GET /courses/${COURSE_ID}/price`, problem(404, "urn:reanit:problem:course-not-found"));

    await expect(getCoursePrice(COURSE_ID)).rejects.toThrow(NotFoundError);
  });
});
