import type { Certificate } from "@reanit/core/learning";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import { VerifiedCertificate } from "./verified-certificate";

const CERTIFICATE: Certificate = {
  id: "6a1d3c2b-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
  studentName: "សុខា ចាន់",
  courseTitle: "Brand Design",
  schoolName: "Angkor Academy",
  // Late evening in UTC is already the next day in Phnom Penh, where the PDF dates it.
  issuedAt: new Date("2026-10-19T20:00:00Z"),
};

describe("VerifiedCertificate", () => {
  it("confirms who completed which course, from which school, on the day the PDF shows", async () => {
    renderWithIntl(<VerifiedCertificate certificate={CERTIFICATE} />);

    expect(await screen.findByRole("heading", { level: 1, name: "សុខា ចាន់" })).toBeInTheDocument();
    expect(screen.getByText("Verified certificate")).toBeInTheDocument();
    expect(screen.getByText("Brand Design")).toBeInTheDocument();
    expect(screen.getByText(/Issued by Angkor Academy on/)).toBeInTheDocument();
    expect(screen.getByText("October 20, 2026")).toHaveAttribute("datetime", "2026-10-19T20:00:00.000Z");
  });

  it("is written in Khmer for km", async () => {
    renderWithIntl(<VerifiedCertificate certificate={CERTIFICATE} />, { locale: "km" });

    expect(await screen.findByText("វិញ្ញាបនបត្រត្រូវបានផ្ទៀងផ្ទាត់")).toBeInTheDocument();
    expect(screen.getByText(/ចេញដោយ Angkor Academy នៅថ្ងៃទី/)).toBeInTheDocument();
    expect(screen.getByText("20 តុលា 2026")).toBeInTheDocument();
  });
});
