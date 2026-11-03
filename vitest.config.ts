import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    fileParallelism: false, // Run test files sequentially so DB fixtures do not interfere
  },
});
