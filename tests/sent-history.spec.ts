import { expect, test } from "@playwright/test";

test("teacher sees sent history with per-student performance", async ({ page }) => {
  await page.goto("/");
  await page.goto("/demo");
  await page.getByTestId("demo-teacher").click();
  await expect(page.getByTestId("row-kyla")).toBeVisible();
  // No history yet in a fresh demo
  await expect(page.getByTestId("sent-history")).toHaveCount(0);
  await page.getByTestId("assign-top").click();
  await page.getByTestId("confirm-assign").click();
  await expect(page.getByTestId("sent-history")).toBeVisible();
  const item = page.locator('[data-testid^="sent-item-"]').first();
  await expect(item).toBeVisible();
  await expect(item).toContainText(/done/);
  await item.getByRole("button", { name: /View students|Tingnan|Tan-awa/ }).click();
  await expect(item.getByText("Andrea Cruz")).toBeVisible();
});
