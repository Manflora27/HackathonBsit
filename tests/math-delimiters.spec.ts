import { expect, test, type Page } from "@playwright/test";

// Models sometimes write math as \(...\) and \[...\] instead of $...$ and $$...$$.
// Regression: a triangle lesson showed "\(110^\circ\)" as raw text instead of 110°.

async function enterAsGrade8(page: Page) {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem("gapfinder-v1", JSON.stringify({ state: { consent: { by: "self", at: 1 }, role: "guest", onboarding: { name: "", subjects: [], grade: null, goal: null, done: false } }, version: 0 })),
  );
  await page.goto("/welcome");
  await page.getByTestId("name").fill("Mika");
  await page.getByTestId("next-step").click();
  await page.getByTestId("grade-8").click();
  await page.getByTestId("next-step").click();
  await page.getByTestId("finish-profile").click();
}

/** The model's JSON as the server streams it (api/_openrouter.ts ndjson), then "done". */
function ndjson(modelJson: object) {
  const text = JSON.stringify(modelJson);
  const lines = [];
  for (let i = 0; i < text.length; i += 7) lines.push(JSON.stringify({ t: "text", d: text.slice(i, i + 7) }));
  lines.push(JSON.stringify({ t: "done", ...modelJson }));
  return { status: 200, contentType: "application/x-ndjson", body: lines.join("\n") + "\n" };
}

test("\\( \\) and \\[ \\] math renders as math: 110°, 70°, 80°", async ({ page }) => {
  const text = {
    hook: "A roof truss has angles \\(110^\\circ\\) and \\(70^\\circ\\). What is the third angle?",
    body: [
      "The angles of a triangle add up to $180^\\circ$, so the last one is:",
      "\\[180^\\circ - 100^\\circ = 80^\\circ\\]",
      "Mixed forms still work: \\(70^\\circ\\) and $80^\\circ$ and $$110^\\circ$$.",
    ],
    pitfall: "", check: { question: "", choices: [], why: "" }, spoken: "Angles.",
  };
  const draft = {
    en: text, fil: text, ceb: text, checkAnswer: -1,
    practice: [
      { prompt: "Find the third angle", given: "180-110-30", form: "any", expected: "40" },
      { prompt: "Find the third angle", given: "180-70-30", form: "any", expected: "80" },
    ],
  };
  await page.route("**/api/lesson", (route) => route.fulfill(ndjson(draft)));
  await enterAsGrade8(page);
  await page.goto("/unit/math-g8-q1-dp");

  const hook = page.getByTestId("lesson-hook");
  const body = page.getByTestId("lesson-body");
  await expect(hook).toContainText("What is the third angle?", { timeout: 90_000 });
  await expect(body).toContainText("Mixed forms still work");

  // What a reader sees: the text with KaTeX's hidden MathML copy (which keeps the source LaTeX) left out.
  const seen = () =>
    page.evaluate(() =>
      ["lesson-hook", "lesson-body"].map((id) => {
        const el = document.querySelector(`[data-testid="${id}"]`)!.cloneNode(true) as HTMLElement;
        el.querySelectorAll(".katex-mathml").forEach((m) => m.remove());
        return el.textContent ?? "";
      }).join("\n"),
    );
  const visible = await seen();
  for (const raw of ["\\(", "\\)", "\\[", "\\]", "$", "\\circ", "^"]) expect(visible).not.toContain(raw);

  // Every angle went through KaTeX: the number with a degree ring (\circ renders as ∘).
  const math = page.locator('[data-testid="lesson-hook"] .katex-html, [data-testid="lesson-body"] .katex-html');
  for (const angle of ["110∘", "70∘", "80∘"]) await expect(math.filter({ hasText: angle }).first()).toBeVisible();
  await expect(hook.locator(".katex-html")).toHaveCount(2);
  // \[...\] is display math, like $$...$$.
  await expect(body.locator(".katex-display").filter({ hasText: "80∘" })).toBeVisible();
});
