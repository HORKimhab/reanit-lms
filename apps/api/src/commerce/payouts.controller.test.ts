import { describe, expect, it } from "vitest";

import { setStaffRole, TEST_SCHOOL, useStaffApp } from "../test/session";

const staff = useStaffApp();
const ACCOUNT = { holderName: "Sokha Chan", bankName: "ABA Bank", account: "000 123 456" };

describe("GET /schools/current/payouts", () => {
  it("shows an admin the balance, next payout date, minimums, payout details and payouts", async () => {
    setStaffRole(staff.clients, "admin");
    staff.clients.payouts.getBalance.mockResolvedValue({
      balances: [{ currency: "USD", available: 4655, onHold: 2450 }],
      nextPayoutDate: new Date("2026-11-01T00:00:00Z"),
      minimums: { USD: 1000, KHR: 4_000_000 },
    });
    staff.clients.payouts.getAccount.mockResolvedValue(ACCOUNT);
    staff.clients.payouts.listPayouts.mockResolvedValue([{ id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a80", currency: "USD", amount: 9000, paidAt: new Date("2026-10-01T02:00:00Z"), reference: "ABA-TRX-1" }]);

    const response = await staff.app.inject({ method: "GET", url: "/schools/current/payouts", headers: staff.headers });

    expect(response.json()).toEqual({
      balances: [{ currency: "USD", available: 4655, onHold: 2450 }],
      nextPayoutDate: "2026-11-01T00:00:00.000Z",
      minimums: { USD: 1000, KHR: 4_000_000 },
      account: ACCOUNT,
      payouts: [{ id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a80", currency: "USD", amount: 9000, paidAt: "2026-10-01T02:00:00.000Z", reference: "ABA-TRX-1" }],
    });
    expect(staff.clients.payoutsFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
  });

  it("refuses an instructor", async () => {
    expect((await staff.app.inject({ method: "GET", url: "/schools/current/payouts", headers: staff.headers })).statusCode).toBe(403);
  });
});

describe("PUT /schools/current/payout-account", () => {
  it("lets the owner save where payouts go, and audits it", async () => {
    setStaffRole(staff.clients, "owner");
    staff.clients.payouts.saveAccount.mockResolvedValue(ACCOUNT);

    const response = await staff.app.inject({ method: "PUT", url: "/schools/current/payout-account", headers: staff.headers, payload: { ...ACCOUNT, holderName: " Sokha Chan " } });

    expect(response.json()).toEqual({ account: ACCOUNT });
    expect(staff.clients.payouts.saveAccount).toHaveBeenCalledWith(ACCOUNT);
    expect(staff.clients.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "school.payout_account.update", targetId: TEST_SCHOOL.id }));
  });

  it("refuses an admin, and empty details", async () => {
    setStaffRole(staff.clients, "admin");
    expect((await staff.app.inject({ method: "PUT", url: "/schools/current/payout-account", headers: staff.headers, payload: ACCOUNT })).statusCode).toBe(403);

    setStaffRole(staff.clients, "owner");
    expect((await staff.app.inject({ method: "PUT", url: "/schools/current/payout-account", headers: staff.headers, payload: { ...ACCOUNT, account: "" } })).statusCode).toBe(400);
  });
});
