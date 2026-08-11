import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    // All vitest files under tests/. tests/rendered-html.test.mjs is a
    // node:test file driven separately by the test script — keep it out.
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
