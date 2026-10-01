import type { Goal } from "./data/curriculum";

/**
 * There is no goal chooser: asking "what's your goal?" forced overlapping answers
 * (preparing for an exam IS catching up). Instead the app derives the same personalization
 * from facts it already has:
 *
 *  - Home ordering is the same for everyone — the diagnosed root gap leads. That is the
 *    product's core promise, not a preference.
 *  - Lesson framing (api/lesson.ts GOAL_HINTS) is picked per lesson from three facts:
 *      examMode (Settings toggle)  -> exam_prep: 6 practice items, two harder, an exam tip
 *      behind on this lesson        -> catch_up: opens with where the topic comes from
 *      in a class                   -> keep_up: ties the topic to this quarter
 *      otherwise (self-paced)       -> explore: why it works, where it shows up
 *
 * The framing never touches correctness: every answer key is engine-checked (SymPy),
 * cached lessons are served as-is, and only intent enums reach the model — no names.
 */

/** The framing for one lesson, derived — not declared. */
export function lessonGoal(opts: { examMode: boolean; behind: boolean; inClass: boolean }): Goal | null {
  if (opts.examMode) return "exam_prep";
  if (opts.behind) return "catch_up";
  return opts.inClass ? "keep_up" : "explore";
}
