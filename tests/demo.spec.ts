import { expect, test } from "@playwright/test";

// The full stage demo, as an acceptance test.
test("Kyla: error circled → trace to Grade 7 gap → practice → retry → teacher sees 14", async ({ page }) => {
  const shot = (name: string) => page.screenshot({ path: `test-results/shots/${name}.png`, fullPage: true });

  await page.goto("/");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /let.s go/i }).click();
  await page.getByTestId("to-demo").click();
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

  await page.goto("/demo");
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
  await page.getByTestId("name").fill("Mika");
  await page.getByTestId("next-step").click();
  await page.getByTestId("subject-math").click();
  await page.getByTestId("grade-8").click();
  await page.getByTestId("next-step").click();
  await page.getByTestId("finish-profile").click();
  await page.goto("/solve/p-try-1"); // the checker itself is reachable once onboarded
  await expect(page.getByText(/Math checker ready/)).toBeVisible({ timeout: 90_000 });

  await context.setOffline(true);
  await page.getByTestId("step-0").fill("3x-2=12");
  await page.getByTestId("check").click();
  await page.getByTestId("confirm").click();
  await expect(page.getByTestId("misconception")).toHaveText("Multiplied only the first term");
  await page.screenshot({ path: "test-results/shots/08-offline.png" });
});

test("landing without Supabase keys: real sign-in is honest, guest and demo still work", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /let.s go/i }).click();
  await expect(page.getByTestId("auth-unconfigured")).toBeVisible();
  await expect(page.getByTestId("google-signin")).toHaveCount(0);
  await expect(page.getByTestId("demo-student")).toHaveCount(0); // no fake accounts on the main screen
  await page.goto("/student");
  await expect(page).toHaveURL(/\/$/); // protected route bounces to sign-in
  await page.screenshot({ path: "test-results/shots/10-signin.png", fullPage: true });
});

test("fresh onboarding: subjects, baseline grade, goal, plan, then a home with no problems on it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /let.s go/i }).click();
  await page.getByTestId("try-it").click();

  await page.getByTestId("name").fill("Mika");
  await page.getByTestId("next-step").click();
  await page.getByTestId("subject-math").click();
  await page.getByTestId("subject-science").click();
  await page.getByTestId("grade-8").click();
  await page.getByTestId("next-step").click();
  await page.getByTestId("goal-catch_up").click();
  await expect(page.getByTestId("plan")).toBeVisible();
  await page.screenshot({ path: "test-results/shots/11-plan.png", fullPage: true });
  await page.getByTestId("finish-profile").click();

  await expect(page.getByTestId("plan-home")).toBeVisible();
  await expect(page.getByTestId("greeting")).toHaveText("Mika.");
  await expect(page.getByTestId("assignment-card")).toHaveCount(0);
});

/** The first lesson saved on the device (IndexedDB). */
async function storedLesson(page: import("@playwright/test").Page) {
  return page.evaluate(
    () =>
      new Promise<{ lesson: { practice: unknown[] }; verified: boolean }>((resolve) => {
        const open = indexedDB.open("gf-lessons", 1);
        open.onsuccess = () => {
          const st = open.result.transaction("lessons").objectStore("lessons");
          const all = st.getAll();
          all.onsuccess = () => resolve(all.result[0]);
        };
      }),
  );
}

const draft = {
  en: { body: ["Expanding means multiplying every term. $(x+1)(x+4)=x^2+5x+4$."], spoken: "Expanding means multiplying every term." },
  fil: { body: ["Ang expanding ay pag-multiply sa bawat term."], spoken: "Ang expanding ay pag-multiply sa bawat term." },
  practice: [
    { prompt: "Expand", given: "(x+1)(x+4)", form: "expanded", expected: "x^2+5x+4" },
    { prompt: "Expand", given: "(x+2)(x+3)", form: "expanded", expected: "x^2+5x+7" }, // wrong key: the gate must drop it
    { prompt: "Expand", given: "(x+1)(x+1)", form: "expanded", expected: "x^2+2x+1" },
  ],
};

async function startPlan(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /let.s go/i }).click();
  await page.getByTestId("try-it").click();
  await page.getByTestId("name").fill("Mika");
  await page.getByTestId("next-step").click();
  await page.getByTestId("subject-math").click();
  await page.getByTestId("grade-8").click();
  await page.getByTestId("next-step").click();
  await page.getByTestId("finish-profile").click();
}

test("lesson pipeline: skeleton, generated lesson, engine drops a wrong key, practice works", async ({ page }) => {
  let release!: () => void;
  const gateOpen = new Promise<void>((r) => (release = r));
  await page.route("**/api/lesson", async (route) => {
    await gateOpen;
    await route.fulfill({ json: draft });
  });
  await startPlan(page);
  await page.getByTestId("unit-math").click();
  await expect(page.getByTestId("lesson-skeleton")).toBeVisible();
  await page.screenshot({ path: "test-results/shots/12-skeleton.png" });
  release();
  await expect(page.getByTestId("lesson-body")).toBeVisible({ timeout: 90_000 });
  const stored = await storedLesson(page);
  expect(stored.lesson.practice).toHaveLength(2); // the wrong key was dropped
  expect(stored.verified).toBe(true);
  await page.getByTestId("to-practice").click();
  await page.getByTestId("practice-answer").fill("x^2+5x+4");
  await page.getByTestId("practice-check").click();
  await expect(page.getByText("Nice!")).toBeVisible();
});

test("lesson pipeline: generation failure keeps the skill in the plan", async ({ page }) => {
  await page.route("**/api/lesson", (route) => route.fulfill({ status: 502, json: { error: "down" } }));
  await startPlan(page);
  await page.getByTestId("unit-math").click();
  await expect(page.getByTestId("lesson-unavailable")).toBeVisible();
});

test("verifiers: unit keys are checked in the browser, wrong ones dropped", async ({ page }) => {
  const units = {
    en: { body: ["Speed is distance over time."], spoken: "Speed is distance over time." },
    fil: { body: ["Ang bilis ay layo bawat oras."], spoken: "Ang bilis ay layo bawat oras." },
    practice: [
      { prompt: "Speed", given: "100 m / 20 s", form: "units", expected: "5 m/s" },
      { prompt: "Force", given: "2 kg * 3 m/s^2", form: "units", expected: "6 N" },
      { prompt: "Speed", given: "100 m / 20 s", form: "units", expected: "6 m/s" }, // wrong
    ],
  };
  await page.route("**/api/lesson", (route) => route.fulfill({ json: units }));
  await page.goto("/");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /let.s go/i }).click();
  await page.getByTestId("try-it").click();
  await page.getByTestId("name").fill("Mika");
  await page.getByTestId("next-step").click();
  await page.getByTestId("subject-science").click();
  await page.getByTestId("grade-11").click();
  await page.getByTestId("next-step").click();
  await page.getByTestId("finish-profile").click();
  await page.getByTestId("unit-science").click();
  await expect(page.getByTestId("lesson-body")).toBeVisible({ timeout: 90_000 });
  const stored = await storedLesson(page);
  expect(stored.lesson.practice).toHaveLength(2);
  expect(stored.verified).toBe(true);
  await page.getByTestId("to-practice").click();
  await page.getByTestId("practice-answer").fill("18 km/h");
  await page.getByTestId("practice-check").click();
  await expect(page.getByText("Nice!")).toBeVisible();
});

test("demo from a fresh onboarding lands in the seeded assignment", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /let.s go/i }).click();
  await page.getByTestId("to-demo").click();
  await page.getByTestId("demo-fresh").click();
  await page.getByTestId("name").fill("Kyla");
  await page.getByTestId("next-step").click();
  await page.getByTestId("subject-math").click();
  await page.getByTestId("grade-9").click();
  await page.getByTestId("next-step").click();
  await page.getByTestId("finish-profile").click();
  await expect(page.getByTestId("assignment-card")).toBeVisible();
  await expect(page.getByTestId("plan-home")).toBeVisible();
});

test("offline pack: download the plan, then open a lesson with no connection", async ({ page, context }) => {
  await page.route("**/api/lesson", (route) => route.fulfill({ json: draft }));
  await startPlan(page);
  await expect(page.getByTestId("pack-math")).toBeVisible();
  await page.getByTestId("pack-go-math").click();
  await expect(page.getByTestId("pack-math")).toContainText("Ready offline", { timeout: 120_000 });
  await context.setOffline(true);
  await page.getByTestId("unit-math").click();
  await expect(page.getByTestId("lesson-body")).toBeVisible();
});

test("old saved state without newer fields still opens onboarding", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem("gapfinder-v1", JSON.stringify({ state: { consent: { by: "self", at: 1 }, role: "guest", onboarding: { subjects: [], grade: null, goal: null, done: false } }, version: 0 })),
  );
  await page.goto("/welcome");
  await expect(page.getByTestId("name")).toBeVisible();
  expect(errors).toEqual([]);
});
