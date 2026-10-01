import { expect, test } from "@playwright/test";

async function enterAsGrade8(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem("gapfinder-v1", JSON.stringify({ state: { consent: { by: "self", at: 1 }, role: "guest", onboarding: { name: "", subjects: [], grade: null, goal: null, done: false } }, version: 0 })),
  );
  await page.goto("/welcome");
  await page.getByTestId("name").fill("Mika");
  await page.getByTestId("next-step").click();
  await page.getByTestId("grade-8").click();
  await page.getByTestId("subject-science").click();
  await page.getByTestId("next-step").click();
}

/** Three multiple-choice questions on one unit; choice 0 is always right. */
const round = (unitId: string, grade: number) => ({
  grade,
  questions: [0, 1, 2].map((n) => ({
    unitId, level: "foundation", kind: "choice", prompt: `Q${grade}-${n}`, given: "", expected: "", form: "any",
    choices: ["right", "wrong", "wrong too"], answer: 0,
  })),
});

test("starting point: missing everything steps further back instead of assuming the grades below", async ({ page }) => {
  const asked: number[] = [];
  await page.route("**/api/ai", async (route) => {
    const body = route.request().postDataJSON();
    if (body.op !== "placement") return route.fallback();
    asked.push(body.grade);
    await route.fulfill({ json: body.grade === 8 ? round("math-g6-q1-mg", 6) : round("math-g5-q1-mg", 5) });
  });
  await enterAsGrade8(page);
  await page.getByTestId("finish-profile").click();

  // Round one: miss all three Grade 6 questions. Each pick shows feedback before moving on.
  for (let n = 0; n < 3; n++) {
    await expect(page.getByText(`Q6-${n}`)).toBeVisible();
    await page.getByTestId("check-choice-1").click();
    await expect(page.getByTestId("check-choice-1")).toHaveAttribute("aria-checked", "true");
  }
  // Round two, further back: get one right.
  await expect(page.getByText("Q5-0")).toBeVisible({ timeout: 10_000 });
  expect([...new Set(asked)]).toEqual([8, 5]); // dev StrictMode may ask twice per round
  await page.getByTestId("check-choice-0").click();
  await page.getByTestId("check-choice-1").click();
  await page.getByTestId("check-choice-1").click();
  await expect(page.getByTestId("check-result")).toBeVisible();
  await expect(page.getByTestId("check-target")).toContainText("Grade 5");
});

test("practice never dead-ends: stuck offers skip, running out offers a retry", async ({ page }) => {
  await page.route("**/api/lesson", (route) => route.fulfill({ json: {
    en: { body: ["Expanding means multiplying every term."], spoken: "Expanding." },
    practice: [
      { prompt: "Expand", given: "(x+1)(x+4)", form: "expanded", expected: "x^2+5x+4" },
      { prompt: "Expand", given: "(x+1)(x+1)", form: "expanded", expected: "x^2+2x+1" },
    ],
  } }));
  await enterAsGrade8(page);
  await page.getByTestId("finish-profile").click();
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("gapfinder-v1") ?? "{}");
    raw.state.placement = { math: { at: Date.now(), score: 1, total: 1, gap: false, unitId: "math-g8-q1-dp" } };
    localStorage.setItem("gapfinder-v1", JSON.stringify(raw));
  });
  await page.goto("/unit/math-g8-q1-dp");
  await page.getByTestId("to-practice").click({ timeout: 90_000 });

  for (let n = 0; n < 2; n++) {
    await page.getByTestId("practice-answer").fill("1");
    await page.getByTestId("practice-check").click();
    await expect(page.getByTestId("practice-answer")).toHaveValue("1");
  }
  await expect(page.getByTestId("practice-stuck")).toBeVisible();
  await page.getByTestId("practice-reveal").click();
  await expect(page.getByTestId("practice-revealed")).toBeVisible();
  await page.getByTestId("practice-next").click();

  await page.getByTestId("practice-answer").fill("x^2+2x+1");
  await page.getByTestId("practice-check").click();
  await expect(page.getByTestId("practice-end")).toBeVisible();
  await expect(page.getByTestId("practice-again")).toBeVisible();
  // Leaving at the end comes back to the lesson, not the last question.
  await page.reload();
  await page.getByTestId("to-practice").click({ timeout: 60_000 });
  await expect(page.getByText("Practice 1/2")).toBeVisible();
  await page.getByTestId("practice-answer").fill("x^2+5x+4");
  await page.getByTestId("practice-check").click();
  await expect(page.getByTestId("combo")).toHaveCount(0);
  await expect(page.getByText("Practice 2/2")).toBeVisible();
  await page.getByTestId("practice-answer").fill("x^2+2x+1");
  await page.getByTestId("practice-check").click();
  await expect(page.getByTestId("mastered")).toBeVisible();
});

test("lesson reads like a page: hook, idea, picture, common mistake, concept check", async ({ page }) => {
  const text = {
    hook: "A jeepney ride costs ₱13 plus ₱2 for every km past the first 4. How much is a 7 km ride?",
    body: [
      "Try it: 5 km costs $13+2=15$, 6 km costs $13+4=17$. Each extra km adds the same ₱2.",
      "That pattern is a **function**: one input, exactly one output. $$f(x)=2x+5$$",
      "It works because the same rule runs on any input, like a machine.",
    ],
    pitfall: "Writing $f(3)=23$ by reading $2x$ as the digits 2 and 3. $2x$ means $2\\cdot x$, so $f(3)=2\\cdot3+5=11$.",
    check: { question: "If $f(x)=2x+5$, what does $f(0)$ mean?", choices: ["The output when the input is 0", "The input when the output is 0", "Always 0"], why: "$f(0)$ puts 0 in for $x$: the output is 5." },
    spoken: "A jeepney ride.",
  };
  await page.route("**/api/lesson", (route) => route.fulfill({ json: {
    en: text, fil: text, ceb: text, checkAnswer: 0,
    figure: { kind: "plot", functions: ["2x+5"], xMin: -1, xMax: 5, yMin: 0, yMax: 16, points: [{ x: 3, y: 11, label: "(3, 11)" }] },
    practice: [
      { prompt: "Evaluate", given: "2*3+5", form: "any", expected: "11" },
      { prompt: "Evaluate", given: "2*0+5", form: "any", expected: "5" },
    ],
  } }));
  await enterAsGrade8(page);
  await page.getByTestId("finish-profile").click();
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("gapfinder-v1") ?? "{}");
    raw.state.placement = { math: { at: Date.now(), score: 1, total: 1, gap: false, unitId: "math-g8-q1-dp" } };
    localStorage.setItem("gapfinder-v1", JSON.stringify(raw));
  });
  await page.goto("/unit/math-g8-q1-dp");
  await expect(page.getByTestId("lesson-hook")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("lesson-pitfall")).toContainText("Common mistake");
  await expect(page.getByTestId("figure-plot")).toBeVisible();
  await page.screenshot({ path: "test-results/shots/lesson-v3.png", fullPage: true });
  await page.getByTestId("concept-choice-1").click();
  await expect(page.getByTestId("concept-why")).toContainText("Not yet");
  await page.getByTestId("concept-choice-0").click();
  await expect(page.getByTestId("concept-why")).toContainText("output is 5");
  await page.screenshot({ path: "test-results/shots/lesson-v3-check.png", fullPage: true });
});

test("practice: wordy AI questions read as text, and leaving keeps your place", async ({ page }) => {
  const text = { body: ["A function gives one output for each input."], spoken: "Functions." };
  await page.route("**/api/lesson", (route) => route.fulfill({ json: {
    en: text, fil: text, ceb: text,
    practice: [
      { prompt: "Evaluate", given: "2*3+5", form: "any", expected: "11" },
      { prompt: "If f(x)=3x+2, find f(4).", given: "f(4) where f(x)=3x+2", form: "any", expected: "14" },
    ],
  } }));
  await enterAsGrade8(page);
  await page.getByTestId("finish-profile").click();
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("gapfinder-v1") ?? "{}");
    raw.state.placement = { math: { at: Date.now(), score: 1, total: 1, gap: false, unitId: "math-g8-q1-dp" } };
    localStorage.setItem("gapfinder-v1", JSON.stringify(raw));
  });
  await page.goto("/unit/math-g8-q1-dp");
  await page.getByTestId("to-practice").click({ timeout: 90_000 });
  await page.getByTestId("practice-answer").fill("11");
  await page.getByTestId("practice-check").click();
  await expect(page.getByText("Practice 2/2")).toBeVisible();

  await page.goto("/student");
  await page.goto("/unit/math-g8-q1-dp");
  await expect(page.getByText("Practice 2/2")).toBeVisible({ timeout: 30_000 });
  // The prompt already says it all: shown once, as words, not italic math.
  await expect(page.getByTestId("practice-question")).toContainText("If f(x)=3x+2, find f(4).");
  await expect(page.getByTestId("practice-question").locator(".katex")).toHaveCount(0);
  await page.screenshot({ path: "test-results/shots/practice-resume.png" });
});

test("roots: one ordered line from where the check placed you up to your grade, with your own progress", async ({ page }) => {
  await enterAsGrade8(page);
  await page.getByTestId("finish-profile").click();
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("gapfinder-v1") ?? "{}");
    raw.state.placement = { math: { at: Date.now(), score: 0, total: 3, gap: true, unitId: "math-g6-q1-mg" } };
    raw.state.progress = { "math-g6-q1-mg": "mastered" };
    raw.state.practiceResume = { "math-g8-q1-dp": { qi: 1, results: [true, null] } };
    localStorage.setItem("gapfinder-v1", JSON.stringify(raw));
  });
  await page.goto("/map");
  const items = page.locator('[data-testid^="roots-unit-"]');
  await expect(items.first()).toHaveAttribute("data-testid", "roots-unit-math-g6-q1-mg");
  await expect(items.first()).toHaveAttribute("data-status", "mastered");
  await expect(items.nth(1)).toHaveAttribute("data-status", "here");
  await expect(page.getByTestId("roots-unit-math-g8-q1-dp")).toHaveAttribute("data-status", "doing");
  // Sorted: grades never go back down along the line.
  const grades = await items.evaluateAll((els) => els.map((e) => Number(/-g(\d+)-/.exec(e.getAttribute("data-testid")!)![1])));
  expect(grades).toEqual([...grades].sort((a, b) => a - b));
  expect(grades.at(-1)).toBe(8);
  await page.screenshot({ path: "test-results/shots/roots.png" });
});
