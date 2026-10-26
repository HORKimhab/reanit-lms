// Boots the real app against the Testcontainers Postgres from `@reanit/db/testing/postgres`.
// Only Redis (health checks) and SMTP are faked; everything else is the production wiring.
import { randomUUID } from "node:crypto";
import { once } from "node:events";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import type { Mailer, MailMessage } from "@reanit/core/auth";
import type { PaymentGateway } from "@reanit/core/commerce";
import type { ObjectStorage } from "@reanit/core/media";
import type { DnsLookup, DomainEdge } from "@reanit/core/schools";
import type { Redis } from "ioredis";
// Types `inject("databaseUrl")` and `inject("redisUrl")` for the e2e files.
import type {} from "@reanit/db/testing/postgres";
import type {} from "@reanit/nest/testing/redis";
import request from "supertest";
import { afterAll, beforeAll, inject } from "vitest";

import { AppModule } from "../app.module";
import { ENV, MAILER, OBJECT_STORAGE } from "@reanit/nest";
import { PAYMENT_GATEWAYS } from "../commerce/commerce.tokens";
import { REDIS } from "../redis/redis.module";
import { DNS_LOOKUP, DOMAIN_EDGE } from "../schools/schools.tokens";
import { RATE_LIMIT_STORAGE, UNLIMITED_RATE } from "./rate-limit";
import { bootTestApp, createFakeClients, TEST_ENV } from "./app";

/** A supertest agent: keeps the cookies the API sets, like a browser. */
export type Agent = ReturnType<typeof request.agent>;

/** In-memory object storage: an upload "arrives" when a test adds its key to `uploaded`. */
type MemoryStorage = ObjectStorage & { uploaded: Set<string> };

/** The app under test, the email it has sent, its object storage, the test gateways' paid and refunded references, and public DNS's TXT records. */
export type E2eApp = {
  app: NestFastifyApplication;
  mail: MailMessage[];
  storage: MemoryStorage;
  paidAtGateway: Set<string>;
  refundedAtGateway: Set<string>;
  txtRecords: Map<string, string[]>;
};

/** Sessions the Stripe-like test gateway refunded. */
const refundedAtGateway = new Set<string>();

/** Stripe without the network: the session id is `cs_e2e_<order id>`, so tests can sign its webhook; refunds are recorded. */
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
  /**
   * Fakes a refund, recording the session it refunded.
   *
   * @param sessionId The session.
   */
  async refund(sessionId) {
    refundedAtGateway.add(sessionId);
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

/** TXT records public DNS answers with, by name; tests add a domain's ownership record to "publish" it. */
const txtRecords = new Map<string, string[]>();

/** Public DNS without the network, answering from `txtRecords`. */
const e2eDns: DnsLookup = {
  /**
   * Fakes a TXT lookup.
   *
   * @param name Fully qualified name.
   * @returns The records a test published there, or none.
   */
  async txtRecords(name) {
    return txtRecords.get(name) ?? [];
  },
};

/** Cloudflare for SaaS without the network: every certificate is issued at once. */
const e2eDomainEdge: DomainEdge = {
  cnameTarget: "customers.reanit.test",
  certificates: {
    /**
     * Fakes adding a custom hostname.
     *
     * @param hostname The verified domain.
     * @returns An active certificate whose id names the hostname.
     */
    async request(hostname) {
      return { id: `cf_${hostname}`, status: "active" };
    },
    /**
     * Fakes a status check.
     *
     * @returns Active.
     */
    async status() {
      return "active";
    },
    /** Fakes deleting a custom hostname. */
    async remove() {},
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
    /**
     * Marks a file the server stored as there.
     *
     * @param object The file.
     * @param object.key Its key.
     */
    async put({ key }) {
      uploaded.add(key);
    },
    /**
     * Forgets a file.
     *
     * @param key The file's key.
     */
    async remove(key) {
      uploaded.delete(key);
    },
  };
}

/**
 * Boots the app on a real, migrated database; rate limits count in a real Redis only when one is given.
 *
 * @param databaseUrl Owner connection from `inject("databaseUrl")`.
 * @param redisUrl Redis from `inject("redisUrl")`, for the tests about rate limits; others never get blocked.
 * @returns The app, an inbox of every email it sends, its in-memory object storage, the gateway's paid references and DNS's TXT records.
 */
async function createE2eApp(databaseUrl: string, redisUrl?: string): Promise<E2eApp> {
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
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(OBJECT_STORAGE)
    .useValue(storage)
    .overrideProvider(PAYMENT_GATEWAYS)
    .useValue([e2ePayWayGateway, e2eStripeGateway])
    .overrideProvider(ENV)
    .useValue({ ...TEST_ENV, DATABASE_URL: databaseUrl, ...(redisUrl && { REDIS_URL: redisUrl }) })
    .overrideProvider(MAILER)
    .useValue(mailer)
    .overrideProvider(DNS_LOOKUP)
    .useValue(e2eDns)
    .overrideProvider(DOMAIN_EDGE)
    .useValue(e2eDomainEdge);
  if (!redisUrl) builder = builder.overrideProvider(REDIS).useValue(createFakeClients().redis).overrideProvider(RATE_LIMIT_STORAGE).useValue(UNLIMITED_RATE);
  const app = await bootTestApp(builder);
  // Rate limits let requests through uncounted until Redis has connected, so tests start once it has.
  const redis = app.get<Redis>(REDIS);
  if (redisUrl && redis.status !== "ready") await once(redis, "ready");
  return { app, mail, storage, paidAtGateway, refundedAtGateway, txtRecords };
}

/**
 * Boots the app before the file's tests and closes it after them.
 *
 * @param options What the file's tests need.
 * @param options.isRateLimited Counts rate limits in the test Redis; off, requests are never blocked.
 * @returns A getter for the app; call it inside tests and hooks, once `beforeAll` has run.
 */
export function useE2eApp({ isRateLimited = false }: { isRateLimited?: boolean } = {}): () => E2eApp {
  let e2e: E2eApp | undefined;
  beforeAll(async () => {
    e2e = await createE2eApp(inject("databaseUrl"), isRateLimited ? inject("redisUrl") : undefined);
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

/**
 * Creates a draft course with one section holding a one-minute video lesson and a text lesson.
 *
 * @param agent The school owner's agent.
 * @param title The course title.
 * @param lessons The lesson ids to use.
 * @param lessons.video The video lesson's id.
 * @param lessons.text The text lesson's id.
 * @returns The new course.
 */
export async function createVideoCourse(agent: Agent, title: string, lessons: { video: string; text: string }): Promise<{ id: string; slug: string }> {
  const { course } = (await agent.post("/courses").send({ title }).expect(201)).body;
  await agent
    .put(`/courses/${course.id}/outline`)
    .send({
      sections: [
        {
          id: randomUUID(),
          title: "One",
          lessons: [
            { id: lessons.video, title: "Intro", type: "video", durationSeconds: 60 },
            { id: lessons.text, title: "Notes", type: "text", durationSeconds: 0 },
          ],
        },
      ],
    })
    .expect(204);
  return course;
}

/**
 * Buys a published, priced course with the PayWay-like test gateway, and lets the order read confirm the payment.
 *
 * @param e2e The app under test.
 * @param buyer The buyer's agent.
 * @param subdomain The school's subdomain.
 * @param courseSlug The course's slug.
 */
export async function buyCourse(e2e: E2eApp, buyer: Agent, subdomain: string, courseSlug: string) {
  const base = `/schools/by-subdomain/${subdomain}`;
  const { orderId } = (await buyer.post(`${base}/checkout`).send({ courseSlug, method: "aba_payway" }).expect(201)).body;
  e2e.paidAtGateway.add(`pw_${orderId}`);
  const order = await buyer.get(`${base}/orders/${orderId}`).expect(200);
  if (order.body.order.status !== "paid") throw new Error(`Order ${orderId} is ${order.body.order.status}, not paid`);
}

