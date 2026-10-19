// Prisma CLI config. DATABASE_URL is the owner connection used by migrations (see .env.example).
import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

const ENV_FILE = ".env";

if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // `prisma generate` needs no connection, so CI can build without DATABASE_URL.
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
