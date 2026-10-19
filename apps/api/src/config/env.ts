import { baseEnvSchema, mailEnvSchema } from "@reanit/nest";
import { z } from "zod";

const DEFAULT_PORT = 4000;

const envSchema = baseEnvSchema
  .extend({
  /** Public origin of the web app: builds links in emails, decides the Secure cookie flag and which origins may send mutating requests. */
  APP_URL: z.url(),
  ...mailEnvSchema.shape,
  /** S3 API endpoint the server calls, e.g. http://localhost:8333 for the local SeaweedFS; leave out for AWS S3. */
  S3_ENDPOINT: z.url().optional(),
  /** Endpoint browsers reach, used in presigned URLs when it differs (e.g. the API inside compose); defaults to S3_ENDPOINT. */
  S3_PUBLIC_ENDPOINT: z.url().optional(),
  /** Region; R2 uses "auto". */
  S3_REGION: z.string().min(1).default("auto"),
  /** Bucket holding lesson videos and PDFs. */
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  /** Local SeaweedFS needs path-style URLs (`endpoint/bucket/key`). */
  S3_FORCE_PATH_STYLE: z.stringbool().default(false),
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
