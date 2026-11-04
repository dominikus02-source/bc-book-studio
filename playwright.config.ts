import { defineConfig } from "@playwright/test";
export default defineConfig({
  testMatch: "dashboard-integration.spec.ts",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3183" },
  webServer: {
    command: "npm run start -- -H 127.0.0.1 -p 3183",
    url: "http://127.0.0.1:3183/api/health",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
