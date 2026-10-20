import path from "node:path";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** `apps/api` origin; matches API_URL in .env.example. Read when the config loads (build and start). */
const API_URL = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // Self-contained server for infra/docker/web.Dockerfile; tracing starts at the repo root to include workspace packages.
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  transpilePackages: ["@reanit/api-client", "@reanit/core", "@reanit/ui"],
  /**
   * Serves the API on this origin under `/api`, so the browser needs no CORS and one cookie
   * covers both (e.g. the emailed magic link opens `/api/auth/magic-link/verify`).
   *
   * @returns The rewrite of `/api/*` to `apps/api`.
   */
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/:path*` }];
  },
};

export default withNextIntl(nextConfig);
