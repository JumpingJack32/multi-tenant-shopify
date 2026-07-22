import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  retries: 1,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  webServer: [
    {
      command: "doppler run -- pnpm --filter storefront dev --port 3000",
      port: 3000,
      cwd: "../..",
      reuseExistingServer: true,
    },
    {
      command: "doppler run -- uvicorn src.main:app --host 0.0.0.0 --port 8000",
      port: 8000,
      cwd: "../../services/backend-api",
      reuseExistingServer: true,
    },
  ],
});
