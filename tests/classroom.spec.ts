import { expect, test, type Page } from "@playwright/test";

/** Sign in with a local test account by email and finish onboarding. Returns the stored account, to switch back later. */
async function signUp(page: Page, email: string, name: string, type: "teacher" | "student") {
  await page.evaluate(() => { localStorage.removeItem("hopper-test-account"); localStorage.removeItem("gapfinder-v1"); });
  await page.goto("/");
  await page.getByTestId("email-signin").click();
  await page.getByTestId("email-input").fill(email);
  await page.getByTestId("email-send").click();
  await expect(page).toHaveURL(/\/welcome/);
  await page.getByTestId(`type-${type}`).click();
  await page.getByTestId("name").fill(name);
  if (type === "student") {
    await page.getByTestId("next-step").click();
    await page.getByTestId("grade-9").click();
    await page.getByTestId("next-step").click();
  }
  await page.getByTestId("finish-profile").click();
  return page.evaluate(() => localStorage.getItem("hopper-test-account")!);
}

/** Switch the signed-in local account, as if signing out and back in. */
async function become(page: Page, account: string, role: "teacher" | "student", to: string) {
  await page.evaluate(([a, r]) => {
    localStorage.setItem("hopper-test-account", a);
    const raw = JSON.parse(localStorage.getItem("gapfinder-v1") ?? '{"state":{}}');
    raw.state = { ...raw.state, role: r, consent: { by: "self", at: 1 }, demo: false };
    localStorage.setItem("gapfinder-v1", JSON.stringify(raw));
  }, [account, role] as const);
  await page.goto(to);
}

test("teacher with two classes sends a quiz, sees only its results, and removes a student who keeps their progress", async ({ page }) => {
  await page.route("**/api/lesson", (route) => route.fulfill({ json: {
    en: { body: ["A function gives one output for each input."], spoken: "Functions." },
    fil: { body: ["x"], spoken: "x" },
    practice: [
      { prompt: "Evaluate", given: "2*3+5", form: "any", expected: "11" },
      { prompt: "Evaluate", given: "2*0+5", form: "any", expected: "5" },
    ],
  } }));
  // The test's own questions: two typed (the engine proves the keys in the teacher's browser), one multiple choice.
  await page.route("**/api/ai", (route) => {
    if (route.request().postDataJSON().op !== "test") return route.fallback();
    const base = { unitId: "math-g9-q1-na", choices: [], answer: 0, why: "Multiply first, then add." };
    return route.fulfill({ json: { questions: [
      { ...base, difficulty: "easy", kind: "typed", prompt: "Evaluate", given: "2*3+5", expected: "11", form: "any" },
      { ...base, difficulty: "medium", kind: "typed", prompt: "Evaluate", given: "2*0+5", expected: "5", form: "any" },
      { ...base, difficulty: "hard", kind: "choice", prompt: "Which is a function?", given: "", expected: "", form: "any", choices: ["y=2x", "x^2+y^2=1", "x=3", "y^2=x"], answer: 0 },
    ] } });
  });
  await page.goto("/");

  // Teacher: two classes.
  const teacher = await signUp(page, "reyes@school.ph", "Ms Reyes", "teacher");
  await expect(page).toHaveURL(/\/teacher$/);
  await page.getByTestId("class-name").fill("Math 9");
  await page.getByTestId("class-grade-9").click();
  await page.getByTestId("class-subject-math").click();
  await page.getByTestId("create-class").click();
  await expect(page).toHaveURL(/\/teacher\/.+/);
  const mathUrl = page.url();
  const code = (await page.getByTestId("class-code-display").textContent())!.trim();
  await page.goto("/teacher");
  await page.getByTestId("new-class").click();
  await page.getByTestId("class-name").fill("Science 9");
  await page.getByTestId("class-grade-9").click();
  await page.getByTestId("class-subject-science").click();
  await page.getByTestId("create-class").click();
  await page.goto("/teacher");
  await expect(page.getByTestId("class-list").locator("li")).toHaveCount(2);

  // Student joins the math class.
  const student = await signUp(page, "mika@school.ph", "Mika", "student");
  await page.goto("/student");
  await page.getByTestId("join-class").getByRole("button").first().click();
  await page.getByTestId("class-code").fill(code);
  await page.getByTestId("join-btn").click();
  // Before joining: the class, and what its teacher will see (Math progress, not other subjects).
  await expect(page.getByTestId("join-sheet")).toContainText("Math 9");
  await expect(page.getByTestId("join-can-see")).toContainText("progress in Mathematics");
  await page.getByTestId("join-confirm").click();
  await expect(page.getByText("Math 9")).toBeVisible();

  // Teacher sends a quiz on one topic.
  await become(page, teacher, "teacher", mathUrl);
  await expect(page.getByTestId("pupil-Mika")).toBeVisible();
  await page.getByTestId("tab-tests").click();
  await page.getByTestId("compose-test").click();
  await page.getByTestId("topic-math-g9-q1-na").click();
  await page.getByTestId("test-title").fill("Functions quiz");
  await page.getByTestId("make-test").click();
  // The teacher reviews every question before it goes out.
  await expect(page.getByTestId("composer-question")).toHaveCount(3);
  await page.getByTestId("send-test").click();
  await expect(page.getByTestId("test-Functions quiz")).toContainText("0 of 1 done");

  // Student takes it: one right, one wrong.
  await become(page, student, "student", "/student");
  await page.getByTestId("take-Functions quiz").click();
  await page.getByTestId("test-answer").fill("11");
  await page.getByTestId("test-next").click();
  await expect(page.getByText("Question 2 of 3")).toBeVisible();
  await page.getByTestId("test-answer").fill("4");
  await page.getByTestId("test-next").click();
  await expect(page.getByText("Question 3 of 3")).toBeVisible();
  await page.getByTestId("test-choice-0").click();
  await expect(page.getByTestId("test-score")).toHaveText("2/3");
  await page.screenshot({ path: "test-results/shots/test-done.png" });

  // Teacher sees the score and the missed topic, then removes the student.
  await become(page, teacher, "teacher", mathUrl);
  await expect(page.getByTestId("class-summary")).toContainText("67%");
  await page.screenshot({ path: "test-results/shots/class-page.png", fullPage: true });
  await page.getByTestId("pupil-Mika").click();
  await expect(page.getByTestId("pupil-sheet")).toContainText("2/3");
  await page.getByTestId("remove-student").click();
  await page.getByTestId("confirm-remove").click();
  await expect(page.getByTestId("removed-toast")).toBeVisible();
  await expect(page.getByTestId("pupil-Mika")).toHaveCount(0);
  await page.goto(mathUrl);
  await expect(page.getByTestId("class-summary")).toHaveCount(0); // her result is no longer visible

  // Student: out of the class, can't rejoin with the code, but her own result is still hers.
  await become(page, student, "student", "/student");
  await expect(page.getByText("Math 9")).toHaveCount(0);
  await page.getByTestId("join-class").getByRole("button").first().click();
  await page.getByTestId("class-code").fill(code);
  await page.getByTestId("join-btn").click();
  await expect(page.getByTestId("join-error")).toContainText(/removed you from this class/);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem("hopper-local-school")!).results.length);
  expect(kept).toBe(1);
});
