import { expect, test } from "@playwright/test";

// The happy path, with every API call cut off: start, onboard, starting-point check, template lesson, practice.
test("offline happy path: start to practice with no network", async ({ page }) => {
  const called: string[] = [];
  await page.route("**/api/**", (route) => { called.push(route.request().url()); return route.abort(); });
  await page.route("**/*.supabase.co/**", (route) => { called.push(route.request().url()); return route.abort(); });

  await page.goto("/");
  await page.getByTestId("start").click();
  await page.getByTestId("name").fill("Mika");
  await page.getByTestId("next-step").click();
  await page.getByTestId("grade-8").click();
  await page.getByTestId("next-step").click();
  await page.getByTestId("finish-profile").click();

  // Starting-point check: template questions, right away.
  await expect(page.getByText("What is 7 × 8?")).toBeVisible();
  for (let n = 0; n < 5; n++) {
    await page.getByTestId("check-choice-1").click();
    await page.waitForTimeout(1300);
  }
  await expect(page.getByTestId("check-result")).toBeVisible();

  // Any unit: lesson generation is tried, fails (no network), and the template lesson opens with the unit's title.
  await page.goto("/unit/science-g8-q1-living");
  await expect(page.getByTestId("lesson-hook")).toBeVisible();
  await page.getByTestId("to-practice").click();
  await page.getByTestId("practice-answer").fill("x=5");
  await page.getByTestId("practice-check").click();
  await expect(page.getByText(/practice 2\/3/i)).toBeVisible(); // right answer: on to the next question
  await expect(page.getByTestId("verified-badge")).not.toContainText("AI");

  // The only calls made were the generation attempts (starting-point check, lesson) the templates stood in for.
  expect(called.length).toBeGreaterThan(0);
  expect(called.every((u) => /\/api\/(ai|lesson)$/.test(u))).toBe(true);
});
