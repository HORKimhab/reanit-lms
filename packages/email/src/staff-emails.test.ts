import { describe, expect, it } from "vitest";

import { staffEmailComposer } from "./compose";

const BASE = {
  locale: "en" as const,
  schoolName: "Angkor Academy",
  unsubscribeUrl: "https://reanit.com/unsubscribe?token=t-1&kind=newSale",
  preferencesUrl: "https://reanit.com/dashboard/settings#notifications",
};

describe("staffEmailComposer", () => {
  it("writes a sale with the buyer, the courses and the total in the course's currency", async () => {
    const email = await staffEmailComposer.newSale({
      ...BASE,
      buyer: { name: "Sokha", email: "sokha@example.com" },
      courseTitles: ["Brand", "Social"],
      total: { amount: 7400, currency: "USD" },
      salesUrl: "https://reanit.com/dashboard/analytics",
    });

    expect(email.subject).toBe("New sale: Brand and Social");
    expect(email.text).toContain("Sokha (sokha@example.com) bought Brand and Social from Angkor Academy for $74.00.");
    expect(email.html).toContain('href="https://reanit.com/dashboard/analytics"');
  });

  it("ends every staff email with why it came and links to stop it or change settings", async () => {
    const email = await staffEmailComposer.courseCompleted({
      ...BASE,
      studentName: null,
      studentEmail: "sokha@example.com",
      courseTitle: "Brand",
      studentsUrl: "https://reanit.com/dashboard/students",
    });

    expect(email.subject).toBe("sokha@example.com completed Brand");
    expect(email.text).toContain("You get this email because you help run Angkor Academy on Reanit.");
    expect(email.html).toContain(`href="${BASE.unsubscribeUrl.replaceAll("&", "&amp;")}"`);
    expect(email.html).toContain(`href="${BASE.preferencesUrl}"`);
    expect(email.text).toContain("Stop these emails");
  });

  it("quotes a comment and names an author without a name as a student", async () => {
    const email = await staffEmailComposer.newComment({
      ...BASE,
      authorName: null,
      body: "How do I export?",
      lessonTitle: "Exports",
      courseTitle: "Brand",
      inboxUrl: "https://reanit.com/dashboard/comments",
    });

    expect(email.subject).toBe("New comment on Exports");
    expect(email.text).toContain("A student commented on Exports in Brand:");
    expect(email.text).toContain("How do I export?");
  });

  it("is written in Khmer for km", async () => {
    const email = await staffEmailComposer.newSale({
      ...BASE,
      locale: "km",
      buyer: { name: null, email: "sokha@example.com" },
      courseTitles: ["Brand"],
      total: { amount: 2_000_000, currency: "KHR" },
      salesUrl: "https://reanit.com/km/dashboard/analytics",
    });

    expect(email.subject).toBe("ការលក់ថ្មី៖ Brand");
    expect(email.html).toContain('lang="km"');
    expect(email.text).toContain("sokha@example.com បានទិញ Brand ពី Angkor Academy");
    expect(email.text).toContain("ឈប់ទទួលអ៊ីមែលទាំងនេះ");
  });
});
