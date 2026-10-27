// @vitest-environment node
import { describe, expect, it } from "vitest";

import { RedirectError } from "@/test/navigation";

import { gatewayStep } from "./gateway-step";

describe("gatewayStep", () => {
  it("keeps a form to post and a code to show", () => {
    expect(gatewayStep({ kind: "form", action: "https://payway.test/purchase", fields: { tran_id: "t" } })).toEqual({ status: "form", action: "https://payway.test/purchase", fields: { tran_id: "t" } });
    expect(gatewayStep({ kind: "qr", qr: "000201", expiresAt: "2026-10-27T12:15:00.000Z" })).toEqual({ status: "qr", qr: "000201", expiresAt: "2026-10-27T12:15:00.000Z" });
  });

  it("leaves the page for a gateway that redirects", () => {
    expect(() => gatewayStep({ kind: "redirect", url: "https://pay.test/p" })).toThrow(new RedirectError("https://pay.test/p"));
  });
});
