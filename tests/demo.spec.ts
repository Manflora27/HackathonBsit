import { expect, test } from "@playwright/test";

// The full stage demo, as an acceptance test.
test("Kyla: error circled → trace to Grade 7 gap → practice → retry → teacher sees 14", async ({ page }) => {
  const shot = (name: string) => page.screenshot({ path: `test-results/shots/${name}.png`, fullPage: true });

  await page.goto("/");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /let.s go/i }).click();
  await page.getByTestId("demo-student").click();
  await expect(page.getByTestId("assignment-card")).toBeVisible();
  await expect(page.getByText(/Math checker ready/)).toBeVisible({ timeout: 90_000 });
  await shot("01-home");
  await page.goto("/map");
  await shot("01b-map");
  await page.goto("/student");

  await page.getByTestId("problem-p-kyla").click();
  await page.getByTestId("fill-demo").click();
  await shot("02a-solve");
  await page.getByTestId("check").click();
  await expect(page.getByText("Is this what you wrote?")).toBeVisible();
  await shot("02-confirm");
  await page.getByTestId("confirm").click();

  await expect(page.getByTestId("misconception")).toHaveText("Squared each term separately");
  await expect(page.getByTestId("expected-line").locator(".gf-mark")).toBeVisible();
  await shot("03-diagnosis");

  await page.getByTestId("find-root").click();
  await shot("03b-probe");
  // poly_mult probe: Kyla gets it wrong -> one level deeper
  await page.getByTestId("probe-answer").fill("x^2+10");
  await page.getByTestId("probe-submit").click();
  await expect(page.getByText(/one level deeper/)).toBeVisible();
  for (const ans of ["-2x+10", "x^5", "7x+2"]) {
    await expect(page.getByTestId("probe-answer")).toHaveValue("");
    await page.getByTestId("probe-answer").fill(ans);
    await page.getByTestId("probe-submit").click();
    await expect(page.getByText(/Not the gap/)).toBeVisible();
  }
  await expect(page.getByTestId("root-gap")).toContainText("Multiplying binomials");
  await expect(page.getByTestId("root-gap")).toContainText("Grade 9");
  await expect(page.getByTestId("root-gap")).toContainText("Grade 7");
  await page.waitForTimeout(3500);
  await shot("04-root-gap");

  await page.getByTestId("start-roadmap").click();
  await shot("05a-learn");
  await page.getByTestId("to-practice").click();
  await page.getByTestId("practice-answer").fill("x^2+5x+4");
  await page.getByTestId("practice-check").click();
  await expect(page.getByTestId("practice-answer")).toHaveValue("");
  await page.getByTestId("practice-answer").fill("x^2+10x+25");
  await page.getByTestId("practice-check").click();
  await expect(page.getByTestId("mastered")).toBeVisible();
  await shot("05-learn");

  await page.getByTestId("retry").click();
  await page.getByTestId("step-0").fill("x+3=±7");
  await page.getByTestId("step-0").press("Enter");
  await page.getByTestId("step-1").fill("x=4 or x=-10");
  await page.getByTestId("check").click();
  await page.getByTestId("confirm").click();
  await expect(page.getByTestId("success")).toContainText("The problem that stopped you");
  await shot("06-retry-success");

  await page.goto("/");
  await page.getByTestId("demo-teacher").click();
  await expect(page.getByTestId("row-kyla")).toBeVisible();
  await expect(page.getByTestId("top-gap-count")).toHaveText("14");
  await expect(page.getByTestId("top-gap-fixed")).toContainText("1 already fixed it");
  await shot("07-teacher");
  await page.getByTestId("assign-top").click();
  await page.getByTestId("confirm-assign").click();
  await expect(page.getByRole("status")).toContainText("Sent to 13");
});

test("airplane mode: still diagnoses with no internet", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /let.s go/i }).click();
  await page.getByTestId("try-it").click();
  await expect(page.getByText(/Math checker ready/)).toBeVisible({ timeout: 90_000 });

  await context.setOffline(true);
  await page.getByTestId("step-0").fill("3x-2=12");
  await page.getByTestId("check").click();
  await page.getByTestId("confirm").click();
  await expect(page.getByTestId("misconception")).toHaveText("Multiplied only the first term");
  await page.screenshot({ path: "test-results/shots/08-offline.png" });
});
