import { expect, type Page } from "@playwright/test";

export async function chooseOption(page: Page, selector: string, value: string) {
  const native = page.locator(selector);
  const label = await native.locator("option").evaluateAll((options, value) => options.find(option => (option as HTMLOptionElement).value === value)?.textContent, value);
  expect(label).toBeTruthy();
  const control = page.locator(".mw-select").filter({ has: native });
  await expect(control).toBeVisible();
  await control.click();
  const dropdown = control.locator(".choices__list--dropdown:popover-open");
  await expect(dropdown).toBeVisible();
  await dropdown.getByRole("option", { name: label!, exact: true }).click();
  await expect(native).toHaveValue(value);
  await expect(dropdown).toHaveCount(0);
}
