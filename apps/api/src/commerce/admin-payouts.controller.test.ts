import { PayoutExceedsBalanceError } from "@reanit/core/commerce";
import { describe, expect, it } from "vitest";

import { useTestApp } from "../test/app";
import { PLATFORM_ADMIN_USER as ADMIN, signInAs, TEST_SCHOOL } from "../test/session";

const test = useTestApp();
const PAYOUT = { schoolId: TEST_SCHOOL.id, currency: "USD", amount: 4655, paidAt: "2026-11-01T09:00:00+07:00", reference: "ABA-TRX-1" };

describe("GET /admin/payouts/due", () => {
  it("lists the payouts due to a platform admin", async () => {
    const headers = signInAs(test.clients, ADMIN);
    const due = { school: { id: TEST_SCHOOL.id, name: TEST_SCHOOL.name, subdomain: TEST_SCHOOL.subdomain }, account: null, currency: "USD", amount: 4655 };
    test.clients.payoutAdmin.listDuePayouts.mockResolvedValue([due]);

    const response = await test.app.inject({ method: "GET", url: "/admin/payouts/due", headers });

    expect(response.json()).toEqual({ payouts: [due] });
  });

  it("refuses anyone else, even a school's owner", async () => {
    const headers = signInAs(test.clients);

    expect((await test.app.inject({ method: "GET", url: "/admin/payouts/due", headers })).statusCode).toBe(403);
    expect(test.clients.payoutAdmin.listDuePayouts).not.toHaveBeenCalled();
  });
});

describe("POST /admin/payouts", () => {
  it("records a transfer by the admin, and audits it in the school's log", async () => {
    const headers = signInAs(test.clients, ADMIN);
    test.clients.payoutAdmin.recordPayout.mockResolvedValue({ id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a80", currency: "USD", amount: 4655, paidAt: new Date("2026-11-01T02:00:00Z"), reference: "ABA-TRX-1" });

    const response = await test.app.inject({ method: "POST", url: "/admin/payouts", headers, payload: PAYOUT });

    expect(response.statusCode).toBe(201);
    expect(response.json().payout).toMatchObject({ schoolId: TEST_SCHOOL.id, amount: 4655, paidAt: "2026-11-01T02:00:00.000Z" });
    expect(test.clients.payoutAdmin.recordPayout).toHaveBeenCalledWith({ ...PAYOUT, paidAt: new Date("2026-11-01T02:00:00Z") }, ADMIN.id);
    expect(test.clients.auditFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
    expect(test.clients.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "payout.record", actorId: ADMIN.id }));
  });

  it("answers 409 for more than the available balance", async () => {
    const headers = signInAs(test.clients, ADMIN);
    test.clients.payoutAdmin.recordPayout.mockRejectedValue(new PayoutExceedsBalanceError());

    const response = await test.app.inject({ method: "POST", url: "/admin/payouts", headers, payload: PAYOUT });

    expect(response.statusCode).toBe(409);
    expect(response.json().type).toBe("urn:reanit:problem:payout-exceeds-balance");
  });
});
