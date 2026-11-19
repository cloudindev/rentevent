import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/rentevent_test" },
  },
});
