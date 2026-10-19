// Boots the real app against the Testcontainers Postgres from `@reanit/db/testing/postgres`.
// Only Redis (health checks) and SMTP are faked; everything else is the production wiring.
import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import type { Mailer, MailMessage } from "@reanit/core/auth";
import type { PaymentGateway } from "@reanit/core/commerce";
import type { ObjectStorage } from "@reanit/core/media";
// Types `inject("databaseUrl")` for the e2e files.
import type {} from "@reanit/db/testing/postgres";
import request from "supertest";
import { afterAll, beforeAll, inject } from "vitest";

import { AppModule } from "../app.module";
import { ENV } from "@reanit/nest";
import { MAILER } from "../mail/mail.module";
import { PAYMENT_GATEWAYS } from "../commerce/commerce.tokens";
import { OBJECT_STORAGE } from "../media/media.tokens";
import { REDIS } from "../redis/redis.module";
import { bootTestApp, createFakeClients, TEST_ENV } from "./app";

/** A supertest agent: keeps the cookies the API sets, like a browser. */
export type Agent = ReturnType<typeof request.agent>;

/** In-memory object storage: an upload "arrives" when a test adds its key to `uploaded`. */
type MemoryStorage = ObjectStorage & { uploaded: Set<string> };

/** The app under test, the email it has sent, its object storage, and the PayWay-like gateway's paid references. */
export type E2eApp = { app: NestFastifyApplication; mail: MailMessage[]; storage: MemoryStorage; paidAtGateway: Set<string> };

/** Stripe without the network: the session id is `cs_e2e_<order id>`, so tests can sign its webhook. */
const e2eStripeGateway: PaymentGateway = {
  method: "stripe",
  /**
   * Takes USD only, as tests expect.
   *
   * @param currency The course's currency.
   * @returns True for USD.
   */
  supports(currency) {
    return currency === "USD";
  },
  /**
   * Fakes a Checkout Session.
   *
   * @param request The order.
   * @returns A redirect naming the session.
   */
  async startPayment(request) {
    return { kind: "redirect", url: `https://checkout.stripe.test/cs_e2e_${request.orderId}`, providerRef: `cs_e2e_${request.orderId}` };
  },
};

/** References the PayWay-like test gateway reports as paid; tests add `pw_<order id>` to "pay". */
const paidAtGateway = new Set<string>();

/** PayWay without the network: posts a form, and answers status checks from `paidAtGateway`. */
const e2ePayWayGateway: PaymentGateway = {
  method: "aba_payway",
  /**
   * Takes USD and KHR.
   *
   * @returns True.
   */
  supports() {
    return true;
  },
  /**
   * Fakes PayWay's checkout form.
   *
   * @param request The order.
   * @returns A form whose reference is `pw_<order id>`.
   */
  async startPayment(request) {
    return { kind: "form", action: "https://payway.test/purchase", fields: { tran_id: `pw_${request.orderId}` }, providerRef: `pw_${request.orderId}` };
  },
  /**
   * Fakes check-transaction.
   *
   * @param providerRef The transaction.
   * @returns "paid" once a test added it to `paidAtGateway`.
   */
  async checkPayment(providerRef) {
    return paidAtGateway.has(providerRef) ? "paid" : "pending";
  },
};

/**
 * Creates storage that signs nothing: URLs name the key, and uploads are simulated.
 *
 * @returns The storage.
 */
function createMemoryStorage(): MemoryStorage {
  const uploaded = new Set<string>();
  return {
    uploaded,
    /**
     * Fakes a presigned upload.
     *
     * @param object What to upload.
     * @param object.key Its key.
     * @param object.contentType Its content type.
     * @returns A URL naming the key, with the header to send.
     */
    async presignUpload({ key, contentType }) {
      return { url: `https://storage.test/${key}`, headers: { "content-type": contentType } };
    },
    /**
     * Fakes a signed download.
     *
     * @param key The file's key.
     * @returns A URL naming the key.
     */
    async presignDownload(key) {
      return `https://storage.test/${key}?signed`;
    },
    /**
     * Tells whether a test simulated the upload.
     *
     * @param key The file's key.
     * @returns True when the key is in `uploaded`.
     */
    async exists(key) {
      return uploaded.has(key);
    },
  };
}

/**
 * Boots the app on a real, migrated database.
 *
 * @param databaseUrl Owner connection from `inject("databaseUrl")`.
 * @returns The app, an inbox of every email it sends, and its in-memory object storage.
 */
async function createE2eApp(databaseUrl: string): Promise<E2eApp> {
  const mail: MailMessage[] = [];
  const storage = createMemoryStorage();
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
    .overrideProvider(OBJECT_STORAGE)
    .useValue(storage)
    .overrideProvider(PAYMENT_GATEWAYS)
    .useValue([e2ePayWayGateway, e2eStripeGateway])
    .overrideProvider(ENV)
    .useValue({ ...TEST_ENV, DATABASE_URL: databaseUrl })
    .overrideProvider(REDIS)
    .useValue(createFakeClients().redis)
    .overrideProvider(MAILER)
    .useValue(mailer);
  return { app: await bootTestApp(builder), mail, storage, paidAtGateway };
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
