import { GATEWAY_REFUND_METHODS } from "@reanit/core/commerce";
import Stripe from "stripe";
import { describe, expect, it } from "vitest";

import { createBakongGateway } from "./bakong-gateway";
import { createPayWayGateway } from "./payway-gateway";
import { createStripeGateway } from "./stripe-gateway";

describe("GATEWAY_REFUND_METHODS", () => {
  it("names exactly the gateways that refund through their API, so the dashboard says the right thing", () => {
    const gateways = [
      createStripeGateway(new Stripe("sk_test_reanit")),
      createPayWayGateway({ merchantId: "m", apiKey: "k", baseUrl: "https://payway.test", pushbackUrl: "https://app.test/api/webhooks/payway" }),
      createBakongGateway({ accountId: "reanit@aclb", merchantName: "Reanit", merchantCity: "Phnom Penh", token: "t", baseUrl: "https://bakong.test" }),
    ];

    expect(gateways.filter((gateway) => gateway.refund).map((gateway) => gateway.method)).toEqual(GATEWAY_REFUND_METHODS);
  });
});
