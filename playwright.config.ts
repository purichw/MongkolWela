import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  workers: 1,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.03
    }
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4324",
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4324",
    url: "http://127.0.0.1:4324",
    reuseExistingServer: !process.env.CI,
    timeout: 90_000
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } }
    },
    {
      name: "firefox-desktop",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 1000 } }
    },
    {
      name: "webkit-desktop",
      use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 1000 } }
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] }
    },
    {
      name: "webkit-mobile",
      use: { ...devices["iPhone 14"] }
    }
  ]
});
