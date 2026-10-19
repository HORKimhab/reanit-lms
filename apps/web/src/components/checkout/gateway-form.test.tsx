import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import { GatewayForm } from "./gateway-form";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GatewayForm", () => {
  it("posts the signed fields to the gateway straight away", async () => {
    // jsdom does not navigate; the submit itself is the boundary.
    const submit = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {});

    const { container } = renderWithIntl(<GatewayForm action="https://payway.test/purchase" fields={{ tran_id: "t1", hash: "h" }} />);

    await screen.findByRole("button", { name: "Continue to payment" });
    const form = container.querySelector("form");
    expect(form).toHaveAttribute("action", "https://payway.test/purchase");
    expect(form).toHaveAttribute("method", "post");
    expect(Object.fromEntries(new FormData(form as HTMLFormElement))).toEqual({ tran_id: "t1", hash: "h" });
    expect(submit).toHaveBeenCalledOnce();
  });
});
