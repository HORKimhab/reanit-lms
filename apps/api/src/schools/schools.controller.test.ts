import { Controller, Get, Module } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
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
