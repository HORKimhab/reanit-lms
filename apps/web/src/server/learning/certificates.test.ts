// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { onApi, problem } from "@/test/api";
import { NotFoundError } from "@/test/navigation";

import { getCertificate } from "./certificates";

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
