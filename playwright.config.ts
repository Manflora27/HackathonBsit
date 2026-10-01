import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: { baseURL: "http://localhost:5199", screenshot: "only-on-failure" },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] }, testIgnore: /classroom\.spec/ },
    // Teacher and student accounts taking turns in one browser, on local test accounts.
    { name: "classroom", use: { ...devices["Pixel 7"], baseURL: "http://localhost:5198" }, testMatch: /classroom\.spec/ },
  ],
  // Tests run with no Supabase keys on their own ports, so a local .env (real keys) never leaks into them.
  webServer: [
    { command: "VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= OPENROUTER_API_KEY= npm run dev -- --port 5199 --strictPort", url: "http://localhost:5199", reuseExistingServer: false, timeout: 120_000 },
    { command: "VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= OPENROUTER_API_KEY= VITE_LOCAL_ACCOUNTS=1 npm run dev -- --port 5198 --strictPort", url: "http://localhost:5198", reuseExistingServer: false, timeout: 120_000 },
  ],
});
