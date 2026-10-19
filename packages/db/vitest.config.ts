import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.int.test.ts"],
    globalSetup: ["./src/test/postgres.ts"],
  },
});
