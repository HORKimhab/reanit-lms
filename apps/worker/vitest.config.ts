import { nestVitestConfig } from "@reanit/config/vitest-nest";

// The integration project starts Postgres and Redis (Docker), once for all its files.
export default nestVitestConfig({
  name: "integration",
  include: ["test/**/*.int.test.ts"],
  globalSetup: ["@reanit/db/testing/postgres", "@reanit/nest/testing/redis"],
});
