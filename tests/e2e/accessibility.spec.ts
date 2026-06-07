import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { keyRoutes, skipIntroLoader } from "./helpers";

test.describe("Accessibility regression", () => {
  for (const route of keyRoutes) {
    test(`axe serious/critical checks ${route.path}`, async ({ page }) => {
      await skipIntroLoader(page);
      await page.goto(route.path, { waitUntil: "domcontentloaded" });

      const result = await new AxeBuilder({ page }).analyze();
      const blockingViolations = result.violations.filter((violation) =>
        violation.impact === "serious" || violation.impact === "critical"
      );

      expect(blockingViolations).toEqual([]);
    });
  }
});
