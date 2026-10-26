import type { OrderReceipt, RenewalNotice } from "@reanit/core/notifications";
import { describe, expect, it } from "vitest";

import { composeMagicLinkEmail, composeTeamInviteEmail, purchaseEmailComposer, renewalEmailComposer } from "./compose";

const LINK = "https://reanit.com/api/auth/magic-link/verify?token=abc&next=%2F";
const RECEIPT: OrderReceipt = {
  orderId: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a40",
  locale: "en",
  paidAt: new Date("2026-10-19T08:00:00Z"),
  buyer: { email: "sokha@example.com", name: "Sokha" },
  school: { name: "Angkor Academy", subdomain: "angkor" },
  items: [{ title: "Brand Design Basics", slug: "brand", amount: 648_000_000, currency: "KHR" }],
  total: { amount: 648_000_000, currency: "KHR" },
};
const WELCOME = {
  locale: "en" as const,
  buyerName: "Sokha",
  schoolName: "Angkor Academy",
  courseTitle: "Brand Design Basics",
  courseUrl: "https://reanit.com/s/angkor/learn/brand",
};

describe("composeMagicLinkEmail", () => {
  it("links to the sign-in URL in both bodies and says how long it works", async () => {
    const email = await composeMagicLinkEmail({ locale: "en", url: LINK, minutes: 15 });

    expect(email.subject).toBe("Your sign-in link");
    expect(email.html).toContain(`href="${LINK.replaceAll("&", "&amp;")}"`);
    expect(email.text).toContain(LINK);
    expect(email.text).toContain("It expires in 15 minutes and works once.");
  });

  it("is written in Khmer for km", async () => {
    const email = await composeMagicLinkEmail({ locale: "km", url: LINK, minutes: 15 });

    expect(email.subject).toBe("តំណចូលគណនីរបស់អ្នក");
    expect(email.html).toContain('lang="km"');
    expect(email.text).toContain("15 នាទី");
  });
});

describe("composeTeamInviteEmail", () => {
  const INVITE_URL = "https://reanit.com/invite?token=abc";

  it("says who invited them to which school as what, links to the invite and says how long it works", async () => {
    const email = await composeTeamInviteEmail({ locale: "en", url: INVITE_URL, school: "Angkor Academy", inviter: "Sokha", role: "instructor", days: 7 });

    expect(email.subject).toBe("Join Angkor Academy on Reanit");
    expect(email.text).toContain("Sokha invited you to help run Angkor Academy as an instructor.");
    expect(email.text).toContain("The invite works for 7 days.");
    expect(email.html).toContain(`href="${INVITE_URL}"`);
  });

  it("names only the school when the inviter gave no name", async () => {
    const email = await composeTeamInviteEmail({ locale: "en", url: INVITE_URL, school: "Angkor Academy", inviter: null, role: "admin", days: 7 });

    expect(email.text).toContain("You're invited to help run Angkor Academy as an admin.");
  });

  it("is written in Khmer for km", async () => {
    const email = await composeTeamInviteEmail({ locale: "km", url: INVITE_URL, school: "Angkor Academy", inviter: "Sokha", role: "admin", days: 7 });

    expect(email.subject).toBe("ចូលរួមជាមួយ Angkor Academy នៅលើ Reanit");
    expect(email.text).toContain("ជាអ្នកគ្រប់គ្រង");
  });
});

describe("purchaseReceipt", () => {
  it("greets the buyer and lists what they paid, in the course's currency, with a link to their courses", async () => {
    const email = await purchaseEmailComposer.purchaseReceipt({ receipt: RECEIPT, myCoursesUrl: "https://reanit.com/s/angkor/my-courses" });

    expect(email.subject).toBe("Your receipt from Angkor Academy");
    expect(email.text).toContain("Hi Sokha,");
    expect(email.text).toContain("Order 6F1C1F3E");
    expect(email.text).toContain("Paid on Oct 19, 2026, 3:00 PM");
    expect(email.text).toContain("Brand Design Basics");
    expect(email.text).toContain("KHR\u00a06,480,000");
    expect(email.html).toContain('href="https://reanit.com/s/angkor/my-courses"');
  });

  it("greets a buyer without a name and writes Khmer money for km", async () => {
    const email = await purchaseEmailComposer.purchaseReceipt({
      receipt: { ...RECEIPT, locale: "km", buyer: { ...RECEIPT.buyer, name: null } },
      myCoursesUrl: "https://reanit.com/km/s/angkor/my-courses",
    });

    expect(email.subject).toBe("បង្កាន់ដៃរបស់អ្នកពី Angkor Academy");
    expect(email.text).toContain("សួស្តី,");
    expect(email.text).toContain("6,480,000៛");
  });

  it("escapes HTML in what users typed", async () => {
    const email = await purchaseEmailComposer.purchaseReceipt({
      receipt: { ...RECEIPT, buyer: { ...RECEIPT.buyer, name: "<b>Sokha</b>" } },
      myCoursesUrl: "https://reanit.com/s/angkor/my-courses",
    });

    expect(email.html).not.toContain("<b>Sokha</b>");
    expect(email.html).toContain("&lt;b&gt;Sokha&lt;/b&gt;");
  });
});

describe("courseWelcome", () => {
  it("welcomes the buyer to the course with a link to start it", async () => {
    const email = await purchaseEmailComposer.courseWelcome(WELCOME);

    expect(email.subject).toBe("Welcome to Brand Design Basics");
    expect(email.text).toContain("You now have Brand Design Basics from Angkor Academy.");
    expect(email.html).toContain('href="https://reanit.com/s/angkor/learn/brand"');
    expect(email.text).toContain("Sent by Angkor Academy through Reanit.");
  });

  it("is written in Khmer for km", async () => {
    const email = await purchaseEmailComposer.courseWelcome({ ...WELCOME, locale: "km", buyerName: null });

    expect(email.subject).toBe("សូមស្វាគមន៍មកកាន់ Brand Design Basics");
    expect(email.text).toContain("ចាប់ផ្តើមរៀន");
  });
});

describe("renewalDue", () => {
  const NOTICE: RenewalNotice = {
    locale: "en",
    student: { email: "dara@example.com", name: null },
    school: { name: "Bayon School", subdomain: "bayon" },
    title: "Brand Studio",
    price: { amount: 40_000_000, currency: "KHR" },
    billing: { kind: "recurring", interval: "year" },
    paidPeriods: 1,
    status: "active",
    currentPeriodEnd: new Date("2027-03-15T02:00:00Z"),
  };
  const PAY_URL = "https://reanit.com/s/bayon/purchases";
  const ACCESS_UNTIL = new Date("2027-03-22T02:00:00Z");

  it("asks to pay the next year before the period ends, in riel, with a link to pay", async () => {
    const email = await renewalEmailComposer.renewalDue({ notice: NOTICE, isLastDay: false, accessUntil: ACCESS_UNTIL, payUrl: PAY_URL });

    expect(email.subject).toBe("Time to renew Brand Studio");
    expect(email.text).toContain("Your yearly subscription to Brand Studio at Bayon School runs until March 15, 2027. Pay KHR\u00a0400,000 for the next year");
    expect(email.text).toContain("your access to Brand Studio ends on March 22, 2027.");
    expect(email.html).toContain(`href="${PAY_URL}"`);
  });

  it("names the instalment of a payment plan", async () => {
    const email = await renewalEmailComposer.renewalDue({
      notice: { ...NOTICE, billing: { kind: "payment_plan", installments: 4 } },
      isLastDay: false,
      accessUntil: ACCESS_UNTIL,
      payUrl: PAY_URL,
    });

    expect(email.text).toContain("Instalment 2 of 4 for Brand Studio at Bayon School is due by March 15, 2027");
  });

  it("says it is the last day", async () => {
    const email = await renewalEmailComposer.renewalDue({ notice: NOTICE, isLastDay: true, accessUntil: ACCESS_UNTIL, payUrl: PAY_URL });

    expect(email.subject).toBe("Last day to keep Brand Studio");
  });

  it("is written in Khmer for km", async () => {
    const email = await renewalEmailComposer.renewalDue({ notice: { ...NOTICE, locale: "km" }, isLastDay: false, accessUntil: ACCESS_UNTIL, payUrl: PAY_URL });

    expect(email.subject).toBe("ដល់ពេលបន្តការជាវ Brand Studio");
    expect(email.html).toContain('lang="km"');
  });
});
