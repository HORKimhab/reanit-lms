import type { PlatformSchoolPage, SubmittedPlanPayment } from "@reanit/core/schools";

/** A page of schools as `GET /admin/schools` answers: one paid and online, one suspended on Free. */
export const SCHOOLS_JSON = {
  schools: [
    {
      id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a01",
      name: "Angkor Academy",
      subdomain: "angkor",
      createdAt: "2026-01-05T00:00:00.000Z",
      ownerEmail: "sokha@example.com",
      plan: "pro",
      paidUntil: "2026-11-27T12:00:00.000Z",
      suspension: null,
    },
    {
      id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a02",
      name: "Mekong Code",
      subdomain: "mekong",
      createdAt: "2026-02-10T00:00:00.000Z",
      ownerEmail: null,
      plan: "free",
      paidUntil: null,
      suspension: { at: "2026-10-20T03:00:00.000Z", reason: "Pirated courses" },
    },
  ],
  total: 51,
  page: 1,
  pageSize: 50,
} as const;

/** The same page as the web app holds it, dates parsed. */
export const SCHOOL_PAGE: PlatformSchoolPage = {
  schools: [
    { ...SCHOOLS_JSON.schools[0], createdAt: new Date("2026-01-05T00:00:00Z"), paidUntil: new Date("2026-11-27T12:00:00Z") },
    { ...SCHOOLS_JSON.schools[1], createdAt: new Date("2026-02-10T00:00:00Z"), suspension: { at: new Date("2026-10-20T03:00:00Z"), reason: "Pirated courses" } },
  ],
  total: 51,
  page: 1,
  pageSize: 50,
};

/** A plan payment to the platform's QR waiting for an admin, as the web app holds it. */
export const SUBMITTED_PLAN_PAYMENT: SubmittedPlanPayment = {
  id: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a70",
  school: { id: SCHOOLS_JSON.schools[0].id, name: "Angkor Academy", subdomain: "angkor" },
  plan: "pro",
  interval: "month",
  amount: 2900,
  reference: "ABA-123",
  submittedAt: new Date("2026-10-27T09:00:00.000Z"),
};

/** A payout due to a school with its payout details. */
export const DUE_PAYOUT = {
  school: SUBMITTED_PLAN_PAYMENT.school,
  account: { holderName: "Sokha Chan", bankName: "ABA", account: "000 123 456" },
  currency: "USD",
  amount: 4655,
} as const;

