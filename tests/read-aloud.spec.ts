import { expect, test, type Page } from "@playwright/test";

// Read aloud, with a stand-in speechSynthesis so the test hears what would be said:
// each utterance "speaks" for 400ms, and window.__tts records what was said and every cancel().
async function fakeVoices(page: Page, voices: { lang: string; name: string }[]) {
  await page.addInitScript((list) => {
    const log = { said: [] as { text: string; lang: string }[], cancels: 0 };
    (window as unknown as { __tts: typeof log }).__tts = log;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let current: SpeechSynthesisUtterance | null = null;
    const synth = {
      getVoices: () => list.map((v) => ({ ...v, voiceURI: v.name, localService: true, default: false })),
      speak(u: SpeechSynthesisUtterance) {
        current = u;
        log.said.push({ text: u.text, lang: u.lang });
        u.onstart?.(new Event("start") as SpeechSynthesisEvent);
        timer = setTimeout(() => { current = null; u.onend?.(new Event("end") as SpeechSynthesisEvent); }, 400);
      },
      cancel() {
        log.cancels++;
        if (timer) clearTimeout(timer);
        const u = current;
        current = null;
        u?.onerror?.(Object.assign(new Event("error"), { error: "canceled" }) as SpeechSynthesisErrorEvent);
      },
      resume() {},
      pause() {},
      addEventListener() {},
      removeEventListener() {},
    };
    Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
    // The real utterance only accepts real voices; a plain object takes the fake ones.
    class Utterance {
      text: string; lang = ""; rate = 1; voice: unknown = null;
      onstart: ((e: Event) => void) | null = null; onend: ((e: Event) => void) | null = null; onerror: ((e: Event) => void) | null = null;
      constructor(text: string) { this.text = text; }
    }
    Object.defineProperty(window, "SpeechSynthesisUtterance", { value: Utterance, configurable: true });
  }, voices);
}

async function openLesson(page: Page) {
  await page.route("**/api/**", (route) => route.abort());
  await page.route("**/*.supabase.co/**", (route) => route.abort());
  await page.goto("/");
  await page.getByTestId("start").click();
  await page.getByTestId("name").fill("Mika");
  await page.getByTestId("next-step").click();
  await page.getByTestId("grade-8").click();
  await page.getByTestId("next-step").click();
  await page.getByTestId("finish-profile").click();
  await expect(page.getByText("What is 7 × 8?")).toBeVisible();
  await page.goto("/unit/science-g8-q1-living");
  await expect(page.getByTestId("lesson-hook")).toBeVisible();
}

const said = (page: Page) => page.evaluate(() => (window as unknown as { __tts: { said: { text: string; lang: string }[] } }).__tts.said);

test("reads the lesson on the page, and tap again stops it", async ({ page }) => {
  await fakeVoices(page, [{ lang: "en-US", name: "English" }]);
  await openLesson(page);
  const button = page.getByTestId("read-aloud");
  await button.click();
  await expect(button).toContainText("Stop");
  await expect.poll(async () => (await said(page)).length).toBeGreaterThan(0);

  // It reads the hook first, as words: no LaTeX or markdown reaches the voice.
  const first = (await said(page))[0];
  const hook = (await page.getByTestId("lesson-hook").innerText()).trim();
  expect(hook.startsWith(first.text.slice(0, 12))).toBe(true);
  expect(first.lang).toBe("en-US");

  await button.click();
  await expect(button).toContainText("Read aloud");
  const count = (await said(page)).length;
  await page.waitForTimeout(1200);
  expect((await said(page)).length).toBe(count); // nothing more after Stop
  for (const s of await said(page)) expect(s.text).not.toMatch(/[$\\*]/);
});

test("leaving the lesson stops reading", async ({ page }) => {
  await fakeVoices(page, [{ lang: "en-US", name: "English" }]);
  await openLesson(page);
  await page.getByTestId("read-aloud").click();
  await expect.poll(async () => (await said(page)).length).toBeGreaterThan(0);
  await page.getByTestId("to-practice").click();
  await expect(page.getByTestId("read-aloud")).toHaveCount(0);
  const count = (await said(page)).length;
  await page.waitForTimeout(1200);
  expect((await said(page)).length).toBe(count);
});

test("says so when the device has no voice", async ({ page }) => {
  await fakeVoices(page, []);
  await openLesson(page);
  await page.getByTestId("read-aloud").click();
  await expect(page.getByTestId("read-aloud-note")).toContainText("No voice on this device");
  await expect(page.getByTestId("read-aloud")).toContainText("Read aloud");
});
