import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: { baseURL: "http://localhost:5199", screenshot: "only-on-failure" },
  projects: [{ name: "phone", use: { ...devices["Pixel 7"] } }],
  // Tests run with no Supabase keys on their own port, so a local .env (real keys) never leaks into them.
  webServer: { command: "VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= npm run dev -- --port 5199 --strictPort", url: "http://localhost:5199", reuseExistingServer: false, timeout: 120_000 },
});
