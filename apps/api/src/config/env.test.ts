import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { parseEnv } from "./env";

const REQUIRED = {
  DATABASE_URL: "postgresql://reanit:reanit@localhost:5432/reanit",
  REDIS_URL: "redis://localhost:6379",
  APP_URL: "http://localhost:3000",
  SMTP_URL: "smtp://localhost:1025",
  MAIL_FROM: "Reanit <no-reply@reanit.localhost>",
  S3_BUCKET: "reanit-media",
  S3_ACCESS_KEY_ID: "key",
  S3_SECRET_ACCESS_KEY: "secret",
};

describe("parseEnv", () => {
  it("applies the default port, host, log level and proxy trust", () => {
    expect(parseEnv(REQUIRED)).toEqual({
      ...REQUIRED,
      PORT: 4000,
      HOST: "0.0.0.0",
      TRUST_PROXY_HOPS: 0,
      LOG_LEVEL: "info",
      S3_REGION: "auto",
      S3_FORCE_PATH_STYLE: false,
      PAYWAY_BASE_URL: "https://checkout-sandbox.payway.com.kh",
      BAKONG_MERCHANT_NAME: "Reanit",
      BAKONG_MERCHANT_CITY: "Phnom Penh",
      BAKONG_BASE_URL: "https://sit-api-bakong.nbc.gov.kh",
      FAKE_PAYMENTS: false,
      PLATFORM_ADMIN_EMAILS: [],
    });
  });

  it("reads the platform admins' emails, trimmed and lower-cased", () => {
    expect(parseEnv({ ...REQUIRED, PLATFORM_ADMIN_EMAILS: " Ops@Reanit.com, dara@reanit.com ," }).PLATFORM_ADMIN_EMAILS).toEqual(["ops@reanit.com", "dara@reanit.com"]);
  });

  it("reads S3_FORCE_PATH_STYLE as a boolean", () => {
    expect(parseEnv({ ...REQUIRED, S3_FORCE_PATH_STYLE: "true" }).S3_FORCE_PATH_STYLE).toBe(true);
  });

  it("accepts Stripe credentials set together", () => {
    expect(parseEnv({ ...REQUIRED, STRIPE_SECRET_KEY: "sk_test_1", STRIPE_WEBHOOK_SECRET: "whsec_1" }).STRIPE_SECRET_KEY).toBe("sk_test_1");
  });

  it.each([{ STRIPE_SECRET_KEY: "sk_test_1" }, { STRIPE_WEBHOOK_SECRET: "whsec_1" }, { PAYWAY_MERCHANT_ID: "m" }, { PAYWAY_API_KEY: "k" }, { BAKONG_ACCOUNT_ID: "a@b" }, { BAKONG_TOKEN: "t" }])("throws a ZodError for half a gateway's credentials: %j", (half) => {
    expect(() => parseEnv({ ...REQUIRED, ...half })).toThrow(ZodError);
  });

  it("accepts the custom domain settings set together", () => {
    const cloudflare = { CLOUDFLARE_API_TOKEN: "token", CLOUDFLARE_ZONE_ID: "zone", CUSTOM_DOMAIN_TARGET: "customers.reanit.com" };

    expect(parseEnv({ ...REQUIRED, ...cloudflare })).toMatchObject(cloudflare);
  });

  it.each([
    { CLOUDFLARE_API_TOKEN: "token" },
    { CLOUDFLARE_ZONE_ID: "zone" },
    { CUSTOM_DOMAIN_TARGET: "customers.reanit.com" },
    { CLOUDFLARE_API_TOKEN: "token", CLOUDFLARE_ZONE_ID: "zone" },
  ])("throws a ZodError for part of the custom domain settings: %j", (part) => {
    expect(() => parseEnv({ ...REQUIRED, ...part })).toThrow(ZodError);
  });

  it("throws a ZodError for a custom domain target that is a URL, not a hostname", () => {
    const cloudflare = { CLOUDFLARE_API_TOKEN: "token", CLOUDFLARE_ZONE_ID: "zone", CUSTOM_DOMAIN_TARGET: "https://customers.reanit.com" };

    expect(() => parseEnv({ ...REQUIRED, ...cloudflare })).toThrow(ZodError);
  });

  it.each(["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000", "http://angkor.localhost:3000"])("allows fake payments when the app runs on %s", (appUrl) => {
    expect(parseEnv({ ...REQUIRED, APP_URL: appUrl, FAKE_PAYMENTS: "true" }).FAKE_PAYMENTS).toBe(true);
  });

  it.each(["https://reanit.com", "https://localhost.reanit.com", "http://10.0.0.5:3000"])("throws a ZodError for fake payments when the app runs on %s", (appUrl) => {
    expect(() => parseEnv({ ...REQUIRED, APP_URL: appUrl, FAKE_PAYMENTS: "true" })).toThrow(ZodError);
  });

  it("throws a ZodError for fake payments next to real Stripe credentials", () => {
    expect(() => parseEnv({ ...REQUIRED, FAKE_PAYMENTS: "true", STRIPE_SECRET_KEY: "sk_test_1", STRIPE_WEBHOOK_SECRET: "whsec_1" })).toThrow(ZodError);
  });

  it("throws a ZodError for an unknown log level", () => {
    expect(() => parseEnv({ ...REQUIRED, LOG_LEVEL: "verbose" })).toThrow(ZodError);
  });

  it("reads TRUST_PROXY_HOPS as a count and rejects a negative one", () => {
    expect(parseEnv({ ...REQUIRED, TRUST_PROXY_HOPS: "2" }).TRUST_PROXY_HOPS).toBe(2);
    expect(() => parseEnv({ ...REQUIRED, TRUST_PROXY_HOPS: "-1" })).toThrow(ZodError);
  });

  it("reads the port as a number", () => {
    expect(parseEnv({ ...REQUIRED, PORT: "8080" }).PORT).toBe(8080);
  });

  it.each(["DATABASE_URL", "REDIS_URL", "APP_URL", "SMTP_URL", "MAIL_FROM", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"])("throws a ZodError when %s is missing", (name) => {
    expect(() => parseEnv({ ...REQUIRED, [name]: undefined })).toThrow(ZodError);
  });

  it.each(["0", "65536", "http"])("throws a ZodError for the port %s", (port) => {
    expect(() => parseEnv({ ...REQUIRED, PORT: port })).toThrow(ZodError);
  });
});
