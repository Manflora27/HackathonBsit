# Additional Considerations — Evidence Map

Each rubric item, what Hopper does about it, and where it lives in the repo. Prepared October 2026.

## 1. Offline capability

Grading never needs a network: SymPy runs on-device in a Pyodide worker (`src/engine/`), and airplane-mode diagnosis is a passing e2e test (`tests/demo.spec.ts`). Lessons persist in device IndexedDB once opened or pack-downloaded, with per-subject "Download for offline" packs (`src/lessons/store.ts`, `src/lessons/pack.ts`, `src/components/OfflinePack.tsx`). Read-aloud uses the device voice. The app shell, fonts, and KaTeX are PWA-precached.

Limits, stated honestly: a never-seen lesson shows a "needs connection" card; photo reading is vision-model only; teacher sync, realtime, and sign-in need connection; classroom writes are best-effort (not queued); first run should happen on Wi-Fi (Pyodide, fonts, packs).

## 2. Accessibility features

Read aloud (device speech), text size 100/115/130%, readable-font swap, reduce-motion switch that freezes Bilog's bounce/spin/drawing (`src/components/Shell.tsx`, `src/index.css`, `src/components/Bilog.tsx`). Gap/mastered states carry `!`/`✓` glyphs plus `aria-label`s, never color alone. Dialogs, radios, tabs, and status messages use proper roles; the skill map has a text equivalent. Motor/low-effort alternatives to typing: math keypad, photo snap. Known gaps: no OS dynamic-type inheritance, no high-contrast theme, no full VoiceOver/TalkBack pass yet.

## 3. Data privacy (RA 10173)

Consent screen before anything is stored; self-practice is private by default and uploads only when class-assigned; unit progress uploads only for the subject of a class the learner joined (`src/classroom.ts`, `src/store.ts`). The AI only ever receives anonymized math — no names, no IDs (`api/ai.ts`, "Only these fields are ever forwarded"). Row Level Security enforces visibility server-side, not just in UI (`supabase/migrations/0001_init.sql`): teachers see class-visible attempts, test results, and progress in their class's subject only. Learners can download their data, delete device data, or delete the account entirely (Settings), and an AI-decisions log shows what the model touched. Removal from a class deletes nothing — progress belongs to the student (`supabase/migrations/0007_remove_student.sql`).

A note on teacher visibility: a teacher sees assigned work, test results, and the student's progress in the class's own subject (topics finished and where they're stuck), and nothing else: no other subjects, no practice answers, no traced mistakes (`sees_subject_progress`, `supabase/migrations/0010_subject_progress.sql`). There is no whole-skill-map sharing. Before joining, the student sees the class, its teacher, and exactly this list, and nothing is shared until they confirm (`src/components/JoinClassSheet.tsx`).

## 4. Responsible AI practices

The core rule (`engine/gapfinder.py:1-8`): correctness is decided by SymPy, never by the model — full brief at `compliance/sympy-vs-llm.html`. The model is fenced into language-shaped jobs (rare-error classification from a closed list, explanations, photo/voice transcription, teacher tips from aggregate counts), every call has a non-AI fallback (`src/ai/client.ts`), and generated lessons only reach learners after the engine re-checks every answer key (`ENGINE_VERIFIED` gate, `api/_lessons.ts`). Low-confidence diagnoses are hidden, not hedged; students can flag a wrong diagnosis and teachers can override it. Student writing is passed as delimited data, never instructions. LLM spend is bounded and logged (`api/_openrouter.ts`, `.env.example`, README setup).

## 5. Multi-language support

UI in English, Tagalog, and Bisaya with English fallback for missing keys (`src/locales/`, `LANGS`/`normalizeLang` in `src/locales/index.ts`). Lessons carry English + Filipino with optional Cebuano; placement checks and insights all follow the learner's language. Known gaps: MATATAG topic titles show English in tl/ceb, and Filipino explanations still need native-speaker review (`docs/PLAN.md` "To Fill In").

## 6. Scalability

Grading is $0 marginal at any user count (on-device). The API is stateless. Class views are bounded — roster 200, tests 50, results over the latest 20 tests (`src/school.ts`) — so page load is flat as history grows: school/division scale with no further work. After that, in order: realtime connection limits, ~30s lesson generations vs serverless timeouts, OpenRouter rate limits (mitigated by warming the shared lesson cache). Full note in `docs/PLAN.md` "Scalability & LMS Integration".

## Joining a class: current UX (noted gap)

Today joining is code-only: the student types the code on Home, gets "invalid code" / "removed — ask your teacher" errors, and on success the class appears with its name and code. There is **no pre-join confirmation showing the teacher's name or classroom details**, and the class list shows no teacher name afterward. Before wider rollout, joining should show "You are joining [class] by [teacher] — they will see your assigned work" with accept/cancel, since joining is the moment visibility changes.
