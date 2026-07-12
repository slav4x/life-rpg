import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, type ViteUserConfig } from "vitest/config";

export default defineConfig({
  // `@vitejs/plugin-react` is typed against a different bundled Vite than the
  // one re-exported by `vitest/config`; the plugins are runtime-compatible, so
  // we cast to Vitest's expected plugin type.
  plugins: react() as ViteUserConfig["plugins"],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // Integration tests share one database and run migrations, so keep test
    // files sequential to avoid races on the shared schema.
    fileParallelism: false,
    include: [
      "tests/unit/**/*.{test,spec}.{ts,tsx}",
      "tests/integration/**/*.{test,spec}.{ts,tsx}",
    ],
    // Playwright owns the e2e suite.
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
});
