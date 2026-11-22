import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import path from "node:path";
import type { Plugin } from "vite";
import { headersFile, SECURITY_HEADERS } from "./worker/lib/headers.ts";

/** Writes `_headers` into the build, so static assets carry the Worker's security headers. */
function securityHeaders(): Plugin {
  return {
    name: "security-headers",
    apply: "build",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "_headers", source: headersFile(SECURITY_HEADERS) });
    },
  };
}

const alias = { "@": path.resolve(import.meta.dirname, "./src") };
const WORKER = "http://localhost:8787";

export default defineConfig(() => ({
  plugins: [react(), securityHeaders()],
  resolve: { alias },
  server: {
    port: 5173,
    proxy: { "/api": WORKER, "/mcp": WORKER },
  },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "app",
          environment: "node",
          include: ["src/**/*.test.ts", "shared/**/*.test.ts"],
        },
      },
      {
        plugins: [
          cloudflareTest(async () => ({
            wrangler: { configPath: "./wrangler.jsonc" },
            miniflare: {
              bindings: {
                TEST_MIGRATIONS: await readD1Migrations(path.resolve(import.meta.dirname, "worker/migrations")),
                ACCESS_TEAM_DOMAIN: "https://test.cloudflareaccess.com",
                ACCESS_AUD_WEB: "aud-web",
                ACCESS_AUD_MCP: "aud-mcp",
                DEV_ACCESS_EMAIL: "a@example.com",
              },
            },
          })),
        ],
        test: {
          name: "worker",
          include: ["worker/**/*.test.ts"],
          setupFiles: ["./worker/test/apply-migrations.ts"],
        },
      },
    ],
  },
}));
