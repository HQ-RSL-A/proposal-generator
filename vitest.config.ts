import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Node is the default (fast, no DOM) for the pure-logic suite. Component tests opt into a DOM
    // per-file with a `// @vitest-environment jsdom` docblock (RSL-33).
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
