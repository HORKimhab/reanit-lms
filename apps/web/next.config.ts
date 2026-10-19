import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["@reanit/core", "@reanit/db", "@reanit/ui"],
};

export default withNextIntl(nextConfig);
