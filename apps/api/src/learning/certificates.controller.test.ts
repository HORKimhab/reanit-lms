import { CertificateNotFoundError } from "@reanit/core/learning";
import { SchoolNotFoundError } from "@reanit/core/schools";
import { describe, expect, it } from "vitest";

import { type FakeClients, useTestApp } from "../test/app";
import { TEST_SCHOOL } from "../test/session";

const CERTIFICATE_ID = "6a1d3c2b-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const URL = `/schools/by-subdomain/${TEST_SCHOOL.subdomain}/certificates/${CERTIFICATE_ID}`;

/**
 * Makes every subdomain resolve to `TEST_SCHOOL`.
 *
 * @param clients Fakes from `createFakeClients`.
 */
function resolveTestSchool(clients: FakeClients) {
  clients.schools.getSchoolBySubdomain.mockResolvedValue(TEST_SCHOOL);
}

const testApp = useTestApp(resolveTestSchool);

describe("certificate verification", () => {
  it("shows a school's certificate to signed-out visitors", async () => {
    testApp.clients.certificates.verifyCertificate.mockResolvedValue({
      id: CERTIFICATE_ID,
      studentName: "សុខា ចាន់",
      courseTitle: "Brand Design",
      schoolName: "Angkor Academy",
      issuedAt: new Date("2026-10-19T08:00:00Z"),
    });

    const response = await testApp.app.inject({ method: "GET", url: URL });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      certificate: { id: CERTIFICATE_ID, studentName: "សុខា ចាន់", courseTitle: "Brand Design", schoolName: "Angkor Academy", issuedAt: "2026-10-19T08:00:00.000Z" },
    });
    expect(testApp.clients.certificatesFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
    expect(testApp.clients.certificates.verifyCertificate).toHaveBeenCalledWith(CERTIFICATE_ID);
  });

  it("answers 404 when the school issued no such certificate", async () => {
    testApp.clients.certificates.verifyCertificate.mockRejectedValue(new CertificateNotFoundError());

    const response = await testApp.app.inject({ method: "GET", url: URL });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ type: "urn:reanit:problem:certificate-not-found" });
  });

  it("answers 400 without a lookup when the code is not a certificate id", async () => {
    const response = await testApp.app.inject({ method: "GET", url: `/schools/by-subdomain/${TEST_SCHOOL.subdomain}/certificates/not-a-code` });

    expect(response.statusCode).toBe(400);
    expect(testApp.clients.certificates.verifyCertificate).not.toHaveBeenCalled();
  });

  it("answers 404 and opens no school's certificates when no school has the subdomain", async () => {
    testApp.clients.schools.getSchoolBySubdomain.mockRejectedValue(new SchoolNotFoundError());

    const response = await testApp.app.inject({ method: "GET", url: `/schools/by-subdomain/missing/certificates/${CERTIFICATE_ID}` });

    expect(response.statusCode).toBe(404);
    expect(testApp.clients.certificatesFor).not.toHaveBeenCalled();
  });
});
