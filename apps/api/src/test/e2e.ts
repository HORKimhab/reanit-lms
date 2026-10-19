// Boots the real app against the Testcontainers Postgres from `@reanit/db/testing/postgres`.
// Only Redis (health checks) and SMTP are faked; everything else is the production wiring.
import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import type { Mailer, MailMessage } from "@reanit/core/auth";
// Types `inject("databaseUrl")` for the e2e files.
import type {} from "@reanit/db/testing/postgres";
import request from "supertest";
import { afterAll, beforeAll, inject } from "vitest";

import { AppModule } from "../app.module";
import { ENV } from "../config/env";
import { MAILER } from "../mail/mail.module";
import { REDIS } from "../redis/redis.module";
import { bootTestApp, createFakeClients, TEST_ENV } from "./app";

/** A supertest agent: keeps the cookies the API sets, like a browser. */
export type Agent = ReturnType<typeof request.agent>;

/** The app under test and the email it has sent. */
export type E2eApp = { app: NestFastifyApplication; mail: MailMessage[] };

/**
 * Boots the app on a real, migrated database.
 *
 * @param databaseUrl Owner connection from `inject("databaseUrl")`.
 * @returns The app and an inbox of every email it sends.
 */
async function createE2eApp(databaseUrl: string): Promise<E2eApp> {
  const mail: MailMessage[] = [];
  const mailer: Mailer = {
    /**
     * Records a message instead of sending it.
     *
     * @param message The email.
     */
    async send(message) {
      mail.push(message);
    },
  };
  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ENV)
    .useValue({ ...TEST_ENV, DATABASE_URL: databaseUrl })
    .overrideProvider(REDIS)
    .useValue(createFakeClients().redis)
    .overrideProvider(MAILER)
    .useValue(mailer);
  return { app: await bootTestApp(builder), mail };
}

/**
 * Boots the app before the file's tests and closes it after them.
 *
 * @returns A getter for the app; call it inside tests and hooks, once `beforeAll` has run.
 */
export function useE2eApp(): () => E2eApp {
  let e2e: E2eApp | undefined;
  beforeAll(async () => {
    e2e = await createE2eApp(inject("databaseUrl"));
  });
  afterAll(async () => {
    await e2e?.app.close();
  });
  // beforeAll has run by the time any test or later hook calls this.
  return () => e2e!;
}

/**
 * Makes a name no other test uses; the database is shared by every e2e file.
 *
 * @param prefix Readable start of the name.
 * @returns The prefix with a random suffix, valid as an email local part and a subdomain.
 */
export function uniqueName(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

/**
 * Signs a new user up through the API.
 *
 * @param app The app under test.
 * @param name Unique name, used for the email.
 * @returns An agent carrying the user's session cookie, and the email.
 */
export async function signUp(app: NestFastifyApplication, name: string): Promise<{ agent: Agent; email: string }> {
  const agent = request.agent(app.getHttpServer());
  const email = `${name}@example.com`;
  await agent.post("/auth/sign-up").send({ name, email, password: "correct horse battery" }).expect(201);
  return { agent, email };
}

/**
 * Signs a new user up and opens a school they own.
 *
 * @param app The app under test.
 * @param name Unique name, used for the email and the subdomain.
 * @returns The owner's agent and the school.
 */
export async function openSchool(
  app: NestFastifyApplication,
  name: string,
): Promise<{ agent: Agent; school: { id: string; name: string; subdomain: string } }> {
  const { agent } = await signUp(app, name);
  const response = await agent.post("/schools").send({ name, subdomain: name }).expect(201);
  return { agent, school: response.body.school };
}
