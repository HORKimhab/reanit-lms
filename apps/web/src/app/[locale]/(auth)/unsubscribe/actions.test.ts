// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { onApi, problem, requestTo } from "@/test/api";
import { formData as form } from "@/test/form";

import { unsubscribe } from "./actions";

vi.mock("next/headers", () => import("@/test/headers"));

const ROUTE = "POST /notifications/unsubscribe";
const LINK = { token: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a01", kind: "newSale" };
const IDLE = { status: "idle" } as const;

describe("unsubscribe", () => {
  it("stops the emails and returns the school's name", async () => {
    onApi(ROUTE, Response.json({ schoolName: "Angkor Academy" }));

    expect(await unsubscribe(IDLE, form(LINK))).toEqual({ status: "done", schoolName: "Angkor Academy" });
    expect(await requestTo(ROUTE)?.json()).toEqual(LINK);
  });

  it("calls a token nobody has invalid", async () => {
    onApi(ROUTE, problem(404, "urn:reanit:problem:invalid-unsubscribe-link"));

    expect(await unsubscribe(IDLE, form(LINK))).toEqual({ status: "invalid" });
  });

  it("calls a malformed link invalid without calling the API", async () => {
    expect(await unsubscribe(IDLE, form({ ...LINK, kind: "marketing" }))).toEqual({ status: "invalid" });
    expect(requestTo(ROUTE)).toBeUndefined();
  });

  it("throws when the API fails", async () => {
    onApi(ROUTE, problem(500));

    await expect(unsubscribe(IDLE, form(LINK))).rejects.toThrow("API answered 500");
  });
});
