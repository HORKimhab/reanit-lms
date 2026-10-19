import { nestVitestConfig } from "@reanit/config/vitest-nest";

// The e2e project starts Postgres (Docker), once for all its files.
export default nestVitestConfig({ name: "e2e", include: ["test/**/*.e2e.test.ts"], globalSetup: ["@reanit/db/testing/postgres"] });
