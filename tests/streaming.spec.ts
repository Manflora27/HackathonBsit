import { expect, test, type Page } from "@playwright/test";

async function enterAsGrade8(page: Page) {
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

/** The model's JSON as the server streams it (api/_openrouter.ts ndjson): cut into small text pieces, mid-word and mid-object, then "done". */
function ndjson(modelJson: object, done: object = modelJson) {
  const text = JSON.stringify(modelJson);
  const lines = [];
  for (let i = 0; i < text.length; i += 7) lines.push(JSON.stringify({ t: "text", d: text.slice(i, i + 7) }));
  lines.push(JSON.stringify({ t: "done", ...done }));
  return { status: 200, contentType: "application/x-ndjson", body: lines.join("\n") + "\n" };
}

test("starting point streams: questions show up in the order written and the check finishes", async ({ page }) => {
  const questions = [0, 1, 2].map((n) => ({
    unitId: "math-g6-q1-mg", level: "foundation", kind: "choice", prompt: `Streamed ${n}`, given: "", expected: "", form: "any",
    choices: ["right", "wrong", "wrong too"], answer: 0,
  }));
  await page.route("**/api/ai", async (route) => {
    const body = route.request().postDataJSON();
    if (body.op !== "placement") return route.fallback();
    expect(body.stream).toBe(true);
    await route.fulfill(ndjson({ questions }, { grade: 8, questions }));
  });
  await enterAsGrade8(page);
  await page.getByTestId("finish-profile").click();
  for (let n = 0; n < 3; n++) {
    await expect(page.getByText(`Streamed ${n}`)).toBeVisible();
    await page.getByTestId("check-choice-0").click();
  }
  await expect(page.getByTestId("check-result")).toBeVisible();
  await expect(page.getByTestId("check-target")).toContainText("Grade 8");
});

test("a streamed lesson renders, and the unit lists the DepEd competencies it serves", async ({ page }) => {
  const text = { hook: "Five friends scored 3, 5, 5, 7 and 10 in a quiz. What score is typical?", body: ["Add them: $3+5+5+7+10=30$, then share: $30/5=6$."], pitfall: "", check: { question: "", choices: [], why: "" }, spoken: "Five friends." };
  const draft = {
    en: text, fil: text, ceb: text, checkAnswer: -1,
    practice: [
      { prompt: "Find the mean", given: "(2+4+6)/3", form: "any", expected: "4" },
      { prompt: "Find the mean", given: "(1+2+3+6)/4", form: "any", expected: "3" },
    ],
  };
  await page.route("**/api/lesson", (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ id: "math-g8-q1-dp", stream: true, lang: "en" });
    return route.fulfill(ndjson(draft));
  });
  await enterAsGrade8(page);
  await page.getByTestId("finish-profile").click();
  await page.goto("/unit/math-g8-q1-dp");
  await expect(page.getByTestId("lesson-hook")).toContainText("What score is typical?", { timeout: 90_000 });
  await page.getByTestId("competencies").locator("summary").click();
  await expect(page.getByTestId("competencies")).toContainText("measures of central tendency");
  await expect(page.getByTestId("competencies")).toContainText("MAT-G8-Q1-001");
});
