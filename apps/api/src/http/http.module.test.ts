import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { EmailTakenError, InvalidCredentialsError, InvalidMagicLinkError, signUpSchema } from "@reanit/core/auth";
import { CourseNotFoundError } from "@reanit/core/catalog";
import {
  InvalidMediaKeyError,
  LessonMediaMissingError,
  LessonNotFoundError,
  MediaNotUploadedError,
  MediaTooLargeError,
  UnsupportedMediaError,
} from "@reanit/core/media";
import { NotEnrolledError } from "@reanit/core/learning";
import { NotSchoolStaffError, SchoolNotFoundError, SubdomainTakenError } from "@reanit/core/schools";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { createTestApp } from "../test/app";
import { captureLogs } from "../test/logs";
import { PROBLEM_CONTENT_TYPE } from "./problem";
import { Public } from "../auth/auth.decorators";
import { createZodDto } from "./zod-dto";

/** Sign-up body validated by the core schema. */
class SignUpBody extends createZodDto(signUpSchema) {}

/** Paging query with a coerced, defaulted number. */
class PageQuery extends createZodDto(z.object({ page: z.coerce.number().int().min(1).default(1) })) {}

/** Core errors the probe can throw, keyed by name; any other name throws an internal error. */
const DOMAIN_ERRORS: Record<string, new () => Error> = {
  EmailTakenError,
  InvalidCredentialsError,
  InvalidMagicLinkError,
  SubdomainTakenError,
  NotSchoolStaffError,
  SchoolNotFoundError,
  CourseNotFoundError,
  LessonNotFoundError,
  LessonMediaMissingError,
  UnsupportedMediaError,
  MediaTooLargeError,
  InvalidMediaKeyError,
  MediaNotUploadedError,
  NotEnrolledError,
};

/** An internal error whose message must never reach the caller. */
const INTERNAL_MESSAGE = "connect ECONNREFUSED 10.0.0.5:5432";

/** Echoes validated input and throws chosen errors, to exercise the global pipe and filter. */
@Public()
@Controller("edge-probe")
class EdgeProbeController {
  /**
   * Echoes a validated body.
   *
   * @param body The parsed body.
   * @returns The body as the handler received it.
   */
  @Post("sign-up")
  signUp(@Body() body: SignUpBody) {
    return body;
  }

  /**
   * Echoes a validated query.
   *
   * @param query The parsed query.
   * @returns The query as the handler received it.
   */
  @Get("page")
  page(@Query() query: PageQuery) {
    return query;
  }

  /**
   * Throws the named error.
   *
   * @param name Key of `DOMAIN_ERRORS`, or anything else for an internal error.
   * @throws {Error} Always.
   */
  @Get("throw/:name")
  throw(@Param("name") name: string) {
    const DomainError = DOMAIN_ERRORS[name];
    throw DomainError ? new DomainError() : new Error(INTERNAL_MESSAGE);
  }
}

const logs = captureLogs();
let app: NestFastifyApplication;

beforeAll(async () => {
  app = await createTestApp(undefined, { controllers: [EdgeProbeController], logStream: logs.stream });
});

afterAll(async () => {
  await app.close();
});

const VALID_SIGN_UP = { name: "Dara", email: "dara@example.com", password: "correct horse battery" };

describe("validation", () => {
  it("passes the parsed body to the handler", async () => {
    const response = await app.inject({ method: "POST", url: "/edge-probe/sign-up", payload: { ...VALID_SIGN_UP, isAdmin: true } });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(signUpSchema.parse(VALID_SIGN_UP));
  });

  it("answers 400 problem+json naming each invalid field", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/edge-probe/sign-up",
      payload: { ...VALID_SIGN_UP, email: "not-an-email", password: "" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain(PROBLEM_CONTENT_TYPE);
    expect(response.json()).toMatchObject({ type: "about:blank", title: "Bad Request", status: 400 });
    expect(response.json().errors.map((error: { pointer: string }) => error.pointer)).toEqual(["#/email", "#/password"]);
  });

  it("answers 400 when the body is missing", async () => {
    const response = await app.inject({ method: "POST", url: "/edge-probe/sign-up" });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain(PROBLEM_CONTENT_TYPE);
  });

  it("applies defaults and coercion to a query", async () => {
    const [none, second] = await Promise.all([
      app.inject({ method: "GET", url: "/edge-probe/page" }),
      app.inject({ method: "GET", url: "/edge-probe/page?page=2" }),
    ]);

    expect(none.json()).toEqual({ page: 1 });
    expect(second.json()).toEqual({ page: 2 });
  });

  it("answers 400 for an invalid query", async () => {
    const response = await app.inject({ method: "GET", url: "/edge-probe/page?page=0" });

    expect(response.statusCode).toBe(400);
    expect(response.json().errors).toEqual([expect.objectContaining({ pointer: "#/page" })]);
  });
});

describe("errors", () => {
  it.each([
    ["EmailTakenError", 409, "email-taken"],
    ["InvalidCredentialsError", 401, "invalid-credentials"],
    ["InvalidMagicLinkError", 400, "invalid-magic-link"],
    ["SubdomainTakenError", 409, "subdomain-taken"],
    ["NotSchoolStaffError", 403, "not-school-staff"],
    ["SchoolNotFoundError", 404, "school-not-found"],
    ["CourseNotFoundError", 404, "course-not-found"],
    ["LessonNotFoundError", 404, "lesson-not-found"],
    ["LessonMediaMissingError", 404, "lesson-media-missing"],
    ["UnsupportedMediaError", 415, "unsupported-media"],
    ["MediaTooLargeError", 413, "media-too-large"],
    ["InvalidMediaKeyError", 400, "invalid-media-key"],
    ["MediaNotUploadedError", 409, "media-not-uploaded"],
    ["NotEnrolledError", 403, "not-enrolled"],
  ])("answers %s with %i and its problem type", async (name, status, code) => {
    const response = await app.inject({ method: "GET", url: `/edge-probe/throw/${name}` });

    expect(response.statusCode).toBe(status);
    expect(response.headers["content-type"]).toContain(PROBLEM_CONTENT_TYPE);
    expect(response.json()).toMatchObject({ type: `urn:reanit:problem:${code}`, status, detail: expect.any(String) });
  });

  it("answers an unknown error with a bare 500 that leaks nothing, and logs it", async () => {
    logs.lines.length = 0;

    const response = await app.inject({ method: "GET", url: "/edge-probe/throw/internal" });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ type: "about:blank", title: "Internal Server Error", status: 500 });
    expect(response.body).not.toContain(INTERNAL_MESSAGE);
    expect(logs.lines.some((line) => line.level === 50 && JSON.stringify(line).includes(INTERNAL_MESSAGE))).toBe(true);
  });

  it("answers an unknown route with 404 problem+json", async () => {
    const response = await app.inject({ method: "GET", url: "/no-such-route" });

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain(PROBLEM_CONTENT_TYPE);
    expect(response.json()).toMatchObject({ type: "about:blank", title: "Not Found", status: 404 });
  });

  it("answers malformed JSON with 400 problem+json", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/edge-probe/sign-up",
      headers: { "content-type": "application/json" },
      payload: "{not json",
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain(PROBLEM_CONTENT_TYPE);
  });
});
