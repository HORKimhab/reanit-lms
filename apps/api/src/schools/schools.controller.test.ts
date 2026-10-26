import { Controller, Get, Module } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { InvalidMediaKeyError, MediaNotUploadedError, MediaTooLargeError, UnsupportedMediaError } from "@reanit/core/media";
import { NotSchoolStaffError, SchoolNotFoundError, SubdomainTakenError } from "@reanit/core/schools";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { RequestContext } from "../context/request-context";
import { createFakeClients, createTestApp, type FakeClients } from "../test/app";
import { signInAs, TEST_SCHOOL, TEST_USER } from "../test/session";
import { CurrentSchool, Roles } from "./schools.decorators";
import { SchoolsModule } from "./schools.module";

/** A route only owners may use, to check `@Roles` against other staff roles. */
@Controller("owners-only")
class OwnersOnlyController {
  /**
   * Echoes the school the guard resolved.
   *
   * @param school The caller's school.
   * @returns The school.
   */
  @Get()
  @Roles("owner")
  read(@CurrentSchool() school: RequestContext["school"]) {
    return school;
  }
}

/** Mounts the probe where `RolesGuard` can be resolved, as a feature module would. */
@Module({ imports: [SchoolsModule], controllers: [OwnersOnlyController] })
class OwnersOnlyModule {}

let clients: FakeClients;
let app: NestFastifyApplication;

beforeEach(async () => {
  clients = createFakeClients();
  app = await createTestApp(clients, { imports: [OwnersOnlyModule] });
});

afterEach(async () => {
  await app.close();
});

describe("POST /schools", () => {
  const BODY = { name: " Angkor Academy ", subdomain: "Angkor" };

  it("opens the school for the signed-in creator with the parsed body", async () => {
    const headers = signInAs(clients);
    clients.schools.createSchool.mockResolvedValue(TEST_SCHOOL);

    const response = await app.inject({ method: "POST", url: "/schools", headers, payload: BODY });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ school: TEST_SCHOOL });
    expect(clients.schools.createSchool).toHaveBeenCalledWith({ name: "Angkor Academy", subdomain: "angkor" }, TEST_USER.id);
  });

  it("answers 409 when the subdomain is taken", async () => {
    const headers = signInAs(clients);
    clients.schools.createSchool.mockRejectedValue(new SubdomainTakenError());

    const response = await app.inject({ method: "POST", url: "/schools", headers, payload: BODY });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ type: "urn:reanit:problem:subdomain-taken" });
  });

  it("answers 400 for a reserved subdomain", async () => {
    const headers = signInAs(clients);

    const response = await app.inject({ method: "POST", url: "/schools", headers, payload: { ...BODY, subdomain: "www" } });

    expect(response.statusCode).toBe(400);
    expect(clients.schools.createSchool).not.toHaveBeenCalled();
  });

  it("answers 401 when signed out", async () => {
    const response = await app.inject({ method: "POST", url: "/schools", payload: BODY });

    expect(response.statusCode).toBe(401);
    expect(clients.schools.createSchool).not.toHaveBeenCalled();
  });
});

describe("GET /schools/by-subdomain/:subdomain", () => {
  it("returns the school and its owner's name to signed-out callers", async () => {
    clients.schools.getPublicSchool.mockResolvedValue({ school: TEST_SCHOOL, ownerName: "Dara Sok" });

    const response = await app.inject({ method: "GET", url: "/schools/by-subdomain/angkor" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ school: TEST_SCHOOL, owner: { name: "Dara Sok" } });
    expect(clients.schools.getPublicSchool).toHaveBeenCalledWith("angkor");
  });

  it("answers 404 when no school has the subdomain", async () => {
    clients.schools.getPublicSchool.mockRejectedValue(new SchoolNotFoundError());

    const response = await app.inject({ method: "GET", url: "/schools/by-subdomain/missing" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ type: "urn:reanit:problem:school-not-found" });
  });

  it("answers 400 for a subdomain no school could have", async () => {
    const response = await app.inject({ method: "GET", url: "/schools/by-subdomain/ab" });

    expect(response.statusCode).toBe(400);
    expect(clients.schools.getPublicSchool).not.toHaveBeenCalled();
  });
});

describe("GET /schools/current", () => {
  it("returns the school the creator runs with their role", async () => {
    const headers = signInAs(clients);
    clients.schools.getStaffSchool.mockResolvedValue({ school: TEST_SCHOOL, role: "instructor" });

    const response = await app.inject({ method: "GET", url: "/schools/current", headers });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ school: TEST_SCHOOL, role: "instructor" });
    expect(clients.schools.getStaffSchool).toHaveBeenCalledWith(TEST_USER.id);
  });

  it("answers 403 when the user runs no school", async () => {
    const headers = signInAs(clients);
    clients.schools.getStaffSchool.mockRejectedValue(new NotSchoolStaffError());

    const response = await app.inject({ method: "GET", url: "/schools/current", headers });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ type: "urn:reanit:problem:not-school-staff" });
  });

  it("answers 401 before looking up a school when signed out", async () => {
    const response = await app.inject({ method: "GET", url: "/schools/current" });

    expect(response.statusCode).toBe(401);
    expect(clients.schools.getStaffSchool).not.toHaveBeenCalled();
  });
});

describe("@Roles", () => {
  it("puts the school in the request context for a matching role", async () => {
    const headers = signInAs(clients);
    clients.schools.getStaffSchool.mockResolvedValue({ school: TEST_SCHOOL, role: "owner" });

    const response = await app.inject({ method: "GET", url: "/owners-only", headers });

    expect(response.json()).toEqual({ ...TEST_SCHOOL, role: "owner" });
  });

  it("answers 403 when the user's role is not one the route accepts", async () => {
    const headers = signInAs(clients);
    clients.schools.getStaffSchool.mockResolvedValue({ school: TEST_SCHOOL, role: "admin" });

    const response = await app.inject({ method: "GET", url: "/owners-only", headers });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ status: 403, title: "Forbidden" });
  });
});

describe("PATCH /schools/current", () => {
  const BODY = { name: " Bayon Academy ", brandColor: "#0055AA", logoKey: `schools/${TEST_SCHOOL.id}/logo/a.png` };
  const UPDATED = { ...TEST_SCHOOL, name: "Bayon Academy", brandColor: "#0055aa", logoUrl: "https://storage.test/logo.png" };

  it.each(["owner", "admin"] as const)("saves the parsed settings of the %s's school", async (role) => {
    const headers = signInAs(clients);
    clients.schools.getStaffSchool.mockResolvedValue({ school: TEST_SCHOOL, role });
    clients.schools.updateSettings.mockResolvedValue(UPDATED);

    const response = await app.inject({ method: "PATCH", url: "/schools/current", headers, payload: BODY });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ school: UPDATED });
    expect(clients.schools.updateSettings).toHaveBeenCalledWith(TEST_SCHOOL.id, { ...BODY, name: "Bayon Academy", brandColor: "#0055aa" });
  });

  it("answers 403 to an instructor", async () => {
    const headers = signInAs(clients);
    clients.schools.getStaffSchool.mockResolvedValue({ school: TEST_SCHOOL, role: "instructor" });

    const response = await app.inject({ method: "PATCH", url: "/schools/current", headers, payload: BODY });

    expect(response.statusCode).toBe(403);
    expect(clients.schools.updateSettings).not.toHaveBeenCalled();
  });

  it("answers 400 for a brand color that is not #rrggbb", async () => {
    const headers = signInAs(clients);
    clients.schools.getStaffSchool.mockResolvedValue({ school: TEST_SCHOOL, role: "owner" });

    const response = await app.inject({ method: "PATCH", url: "/schools/current", headers, payload: { ...BODY, brandColor: "red" } });

    expect(response.statusCode).toBe(400);
    expect(clients.schools.updateSettings).not.toHaveBeenCalled();
  });

  it.each([
    [new InvalidMediaKeyError(), 400, "invalid-media-key"],
    [new MediaNotUploadedError(), 409, "media-not-uploaded"],
  ])("maps %s to %i", async (error, status, code) => {
    const headers = signInAs(clients);
    clients.schools.getStaffSchool.mockResolvedValue({ school: TEST_SCHOOL, role: "owner" });
    clients.schools.updateSettings.mockRejectedValue(error);

    const response = await app.inject({ method: "PATCH", url: "/schools/current", headers, payload: BODY });

    expect(response.statusCode).toBe(status);
    expect(response.json()).toMatchObject({ type: `urn:reanit:problem:${code}` });
  });
});

describe("POST /schools/current/payment-qr-uploads", () => {
  it("presigns the payment QR upload for an admin's school", async () => {
    const headers = signInAs(clients);
    clients.schools.getStaffSchool.mockResolvedValue({ school: TEST_SCHOOL, role: "admin" });
    clients.schools.requestImageUpload.mockResolvedValue({ key: "schools/s/payment-qr/a.png", url: "https://storage.test/a", headers: {}, expiresAt: new Date("2026-10-19T00:15:00Z") });

    const response = await app.inject({ method: "POST", url: "/schools/current/payment-qr-uploads", headers, payload: { contentType: "image/png", sizeBytes: 2048 } });

    expect(response.statusCode).toBe(201);
    expect(clients.schools.requestImageUpload).toHaveBeenCalledWith(TEST_SCHOOL.id, "payment-qr", { contentType: "image/png", sizeBytes: 2048 });
  });
});

describe("POST /schools/current/logo-uploads", () => {
  const BODY = { contentType: "image/png", sizeBytes: 2048 };

  it("presigns the logo upload for the owner's school", async () => {
    const headers = signInAs(clients);
    clients.schools.getStaffSchool.mockResolvedValue({ school: TEST_SCHOOL, role: "owner" });
    const upload = { key: "schools/s/logo/a.png", url: "https://storage.test/a", headers: { "content-type": "image/png" } };
    clients.schools.requestImageUpload.mockResolvedValue({ ...upload, expiresAt: new Date("2026-10-19T00:15:00Z") });

    const response = await app.inject({ method: "POST", url: "/schools/current/logo-uploads", headers, payload: BODY });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ ...upload, expiresAt: "2026-10-19T00:15:00.000Z" });
    expect(clients.schools.requestImageUpload).toHaveBeenCalledWith(TEST_SCHOOL.id, "logo", BODY);
  });

  it("answers 403 to an instructor", async () => {
    const headers = signInAs(clients);
    clients.schools.getStaffSchool.mockResolvedValue({ school: TEST_SCHOOL, role: "instructor" });

    expect((await app.inject({ method: "POST", url: "/schools/current/logo-uploads", headers, payload: BODY })).statusCode).toBe(403);
  });

  it.each([
    [new UnsupportedMediaError(), 415],
    [new MediaTooLargeError(), 413],
  ])("maps %s to %i", async (error, status) => {
    const headers = signInAs(clients);
    clients.schools.getStaffSchool.mockResolvedValue({ school: TEST_SCHOOL, role: "owner" });
    clients.schools.requestImageUpload.mockRejectedValue(error);

    expect((await app.inject({ method: "POST", url: "/schools/current/logo-uploads", headers, payload: BODY })).statusCode).toBe(status);
  });
});
