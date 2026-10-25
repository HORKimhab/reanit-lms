// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { NotFoundError, RedirectError } from "@/test/navigation";
import { signIn } from "@/test/session";

import { getCertificate, getCertificateDownloadUrl, getCertificateTemplate } from "./certificates";

vi.mock("next/headers", () => import("@/test/headers"));

const CERTIFICATE_ID = "6a1d3c2b-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const URL = `GET /schools/by-subdomain/angkor/certificates/${CERTIFICATE_ID}`;

describe("getCertificate", () => {
  it("loads the certificate with its date", async () => {
    onApi(
      URL,
      Response.json({
        certificate: { id: CERTIFICATE_ID, studentName: "Sokha", courseTitle: "Brand Design", schoolName: "Angkor Academy", issuedAt: "2026-10-19T08:00:00.000Z" },
      }),
    );

    expect(await getCertificate("angkor", CERTIFICATE_ID)).toEqual({
      id: CERTIFICATE_ID,
      studentName: "Sokha",
      courseTitle: "Brand Design",
      schoolName: "Angkor Academy",
      issuedAt: new Date("2026-10-19T08:00:00.000Z"),
    });
  });

  it("404s when the school issued no such certificate", async () => {
    onApi(URL, problem(404, "urn:reanit:problem:certificate-not-found"));

    await expect(getCertificate("angkor", CERTIFICATE_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("404s when the link's code is not a certificate id", async () => {
    onApi("GET /schools/by-subdomain/angkor/certificates/forged", problem(400));

    await expect(getCertificate("angkor", "forged")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("getCertificateDownloadUrl", () => {
  const DOWNLOAD = "GET /schools/by-subdomain/angkor/learn/brand/certificate";

  it("gives the signed link to the student's certificate", async () => {
    signIn();
    onApi(DOWNLOAD, Response.json({ url: "https://storage.test/cert.pdf?signed", expiresAt: "2026-10-25T08:05:00.000Z" }));

    expect(await getCertificateDownloadUrl("angkor", "brand", "/s/angkor/learn/brand/certificate")).toBe("https://storage.test/cert.pdf?signed");
  });

  it("gives null while the certificate is not ready", async () => {
    signIn();
    onApi(DOWNLOAD, problem(404, "urn:reanit:problem:certificate-not-found"));

    expect(await getCertificateDownloadUrl("angkor", "brand", "/s/angkor/learn/brand/certificate")).toBeNull();
  });

  it("sends a signed-out visitor to log in and back", async () => {
    onApi(DOWNLOAD, problem(401));

    const redirect = getCertificateDownloadUrl("angkor", "brand", "/s/angkor/learn/brand/certificate");

    await expect(redirect).rejects.toBeInstanceOf(RedirectError);
    await expect(redirect).rejects.toMatchObject({ url: expect.stringContaining(encodeURIComponent("/s/angkor/learn/brand/certificate")) });
  });
});

describe("getCertificateTemplate", () => {
  it("reads the school's template", async () => {
    signIn();
    onApi("GET /certificates/template", Response.json({ template: { signerName: "Dara Kim", signerTitle: null } }));

    expect(await getCertificateTemplate()).toEqual({ signerName: "Dara Kim", signerTitle: null });
  });
});
