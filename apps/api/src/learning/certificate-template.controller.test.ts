import { describe, expect, it } from "vitest";

import {setStaffRole, TEST_SCHOOL, useStaffApp } from "../test/session";

const TEMPLATE = { signerName: "Dara Kim", signerTitle: "Founder" };
const staff = useStaffApp();

describe("GET /certificates/template", () => {
  it("reads the template of the caller's school", async () => {
    setStaffRole(staff.clients, "owner");
    staff.clients.certificates.getTemplate.mockResolvedValue(TEMPLATE);

    const response = await staff.app.inject({ method: "GET", url: "/certificates/template", headers: staff.headers });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ template: TEMPLATE });
    expect(staff.clients.certificatesFor).toHaveBeenCalledWith(TEST_SCHOOL.id);
  });
});

describe("PUT /certificates/template", () => {
  it("saves the parsed template, blank fields as null, and records it in the audit log", async () => {
    setStaffRole(staff.clients, "owner");
    staff.clients.certificates.saveTemplate.mockResolvedValue({ signerName: "Dara Kim", signerTitle: null });

    const response = await staff.app.inject({
      method: "PUT",
      url: "/certificates/template",
      headers: staff.headers,
      payload: { signerName: " Dara Kim ", signerTitle: "" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ template: { signerName: "Dara Kim", signerTitle: null } });
    expect(staff.clients.certificates.saveTemplate).toHaveBeenCalledWith({ signerName: "Dara Kim", signerTitle: null });
    expect(staff.clients.audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "certificate.template.update", targetId: TEST_SCHOOL.id }));
  });

  it("answers 400 for a signer name over the limit", async () => {
    setStaffRole(staff.clients, "owner");

    const response = await staff.app.inject({
      method: "PUT",
      url: "/certificates/template",
      headers: staff.headers,
      payload: { signerName: "a".repeat(81), signerTitle: null },
    });

    expect(response.statusCode).toBe(400);
    expect(staff.clients.certificates.saveTemplate).not.toHaveBeenCalled();
  });

  it("refuses an instructor: the template is for owners and admins", async () => {
    const response = await staff.app.inject({ method: "PUT", url: "/certificates/template", headers: staff.headers, payload: TEMPLATE });

    expect(response.statusCode).toBe(403);
    expect(staff.clients.certificates.saveTemplate).not.toHaveBeenCalled();
  });
});
