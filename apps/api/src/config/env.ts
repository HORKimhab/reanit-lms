import { baseEnvSchema, mailEnvSchema, storageEnvSchema } from "@reanit/nest";
import { z } from "zod";

const DEFAULT_PORT = 4000;

/** Hosts that only ever reach the machine itself. */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Tells whether a URL points at this machine, as it does only in development and tests.
 *
 * @param url An absolute URL.
 * @returns True for localhost (and its subdomains) and the loopback addresses.
 */
function isLocalhost(url: string): boolean {
  const { hostname } = new URL(url);
  return LOOPBACK_HOSTS.has(hostname) || hostname.endsWith(".localhost");
}

const envSchema = baseEnvSchema
  .extend({
  /** Public origin of the web app: builds links in emails, decides the Secure cookie flag and which origins may send mutating requests. */
  APP_URL: z.url(),
  ...mailEnvSchema.shape,
  ...storageEnvSchema.shape,
  /** Stripe secret key; Stripe is offered at checkout only when it and the webhook secret are set. */
  STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
  /** Signing secret of the Stripe webhook endpoint (`whsec_...`). */
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  /** ABA PayWay merchant profile; PayWay is offered at checkout only when the id and API key are set. */
  PAYWAY_MERCHANT_ID: z.string().min(1).optional(),
  PAYWAY_API_KEY: z.string().min(1).optional(),
  /** PayWay host: the sandbox until the profile goes live (https://checkout.payway.com.kh). */
  PAYWAY_BASE_URL: z.url().default("https://checkout-sandbox.payway.com.kh"),
  /** Bakong account paid by KHQR (e.g. `reanit@aclb`); Bakong KHQR is offered at checkout only when it and the token are set. */
  BAKONG_ACCOUNT_ID: z.string().min(1).optional(),
  /** Bakong Open API token (api-bakong.nbc.gov.kh); renew it before it expires every 90 days. */
  BAKONG_TOKEN: z.string().min(1).optional(),
  /** Payee name and city banking apps show; KHQR allows 25 and 15 characters. */
  BAKONG_MERCHANT_NAME: z.string().min(1).max(25).default("Reanit"),
  BAKONG_MERCHANT_CITY: z.string().min(1).max(15).default("Phnom Penh"),
  /** Bakong Open API host: the sandbox until the account goes live (https://api-bakong.nbc.gov.kh). */
  BAKONG_BASE_URL: z.url().default("https://sit-api-bakong.nbc.gov.kh"),
  /** Cloudflare API token that may edit the zone's SSL and certificates; custom domains are offered only when it, the zone and the target are set. */
  CLOUDFLARE_API_TOKEN: z.string().min(1).optional(),
  /** Zone of the root domain, with Cloudflare for SaaS enabled; custom domains become its custom hostnames. */
  CLOUDFLARE_ZONE_ID: z.string().min(1).optional(),
  /** The zone's fallback origin, which every custom domain CNAMEs to, e.g. `customers.reanit.com`. */
  CUSTOM_DOMAIN_TARGET: z.hostname().optional(),
  /** Emails of the platform's admins, comma-separated: they run the admin console (schools, plan payments to the platform's QR, payouts). */
  PLATFORM_ADMIN_EMAILS: z
    .string()
    .default("")
    .transform((value) => value.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean)),
  /** Public URL of the platform's own payment QR image; when set, creators can pay for a plan by scanning it and a platform admin confirms the transfer. */
  PLATFORM_PAYMENT_QR_URL: z.url().optional(),
  /**
   * End-to-end tests only: card payments go to a fake that pays every order as soon as it is checked.
   * Refused unless APP_URL is a localhost address, so it can never take orders on a real deployment.
   */
  FAKE_PAYMENTS: z.stringbool().default(false),
  PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  /** Interface to listen on; all of them by default, as a container needs. */
  HOST: z.string().min(1).default("0.0.0.0"),
  /**
   * Proxies in front of the API that append the caller's address to X-Forwarded-For (a load balancer,
   * the web app's /api rewrite), so rate limits count the browser's address. 0 trusts none: every
   * request counts as the address it came from. Never set it higher than the proxies there are, or callers can fake their address.
   */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  })
  .refine((env) => Boolean(env.STRIPE_SECRET_KEY) === Boolean(env.STRIPE_WEBHOOK_SECRET), {
    message: "Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET together",
    path: ["STRIPE_WEBHOOK_SECRET"],
  })
  .refine((env) => Boolean(env.PAYWAY_MERCHANT_ID) === Boolean(env.PAYWAY_API_KEY), {
    message: "Set PAYWAY_MERCHANT_ID and PAYWAY_API_KEY together",
    path: ["PAYWAY_API_KEY"],
  })
  .refine((env) => Boolean(env.BAKONG_ACCOUNT_ID) === Boolean(env.BAKONG_TOKEN), {
    message: "Set BAKONG_ACCOUNT_ID and BAKONG_TOKEN together",
    path: ["BAKONG_TOKEN"],
  })
  .refine((env) => new Set([env.CLOUDFLARE_API_TOKEN, env.CLOUDFLARE_ZONE_ID, env.CUSTOM_DOMAIN_TARGET].map(Boolean)).size === 1, {
    message: "Set CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID and CUSTOM_DOMAIN_TARGET together",
    path: ["CUSTOM_DOMAIN_TARGET"],
  })
  .refine((env) => !env.FAKE_PAYMENTS || isLocalhost(env.APP_URL), {
    message: "FAKE_PAYMENTS is for end-to-end tests: APP_URL must be a localhost address",
    path: ["FAKE_PAYMENTS"],
  })
  .refine((env) => !env.FAKE_PAYMENTS || !env.STRIPE_SECRET_KEY, {
    message: "FAKE_PAYMENTS takes Stripe's place: leave the Stripe credentials unset",
    path: ["FAKE_PAYMENTS"],
  });

/** The API's validated environment. */
export type Env = z.infer<typeof envSchema>;

/**
 * Validates the environment so a misconfigured API fails at boot, not on the first request.
 *
 * @param source Variables to read.
 * @returns The validated variables with defaults applied.
 * @throws {z.ZodError} When a variable is missing or malformed.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source);
}
