import { useStore } from "./store";
import type { Lang } from "./types";

const STRINGS = {
  tagline: { en: "Find the one skill behind the mistake.", fil: "Hanapin ang isang skill sa likod ng pagkakamali." },
  checkWork: { en: "Check my work", fil: "I-check ang solusyon ko" },
  stuck: { en: "Stuck on a problem?", fil: "Na-stuck sa isang problem?" },
  mySkillMap: { en: "My skill map", fil: "Aking skill map" },
  assignments: { en: "Assignments", fil: "Mga assignment" },
  onlyYou: { en: "Only you can see this", fil: "Ikaw lang ang nakakakita nito" },
  isThisWhatYouWrote: { en: "Is this what you wrote?", fil: "Ito ba ang isinulat mo?" },
  yesCheck: { en: "Yes, check it", fil: "Oo, i-check" },
  edit: { en: "Edit", fil: "I-edit" },
  foundIt: { en: "Found it", fil: "Nahanap na" },
  findRoot: { en: "Find the root gap", fil: "Hanapin ang ugat na gap" },
  readAloud: { en: "Read aloud", fil: "Basahin nang malakas" },
  practice: { en: "Practice", fil: "Practice" },
  retry: { en: "Retry the original problem", fil: "Subukan ulit ang orihinal na problem" },
  step: { en: "Step", fil: "Step" },
  addStep: { en: "Add a step", fil: "Magdagdag ng step" },
  allCorrect: { en: "Every step checks out.", fil: "Tama ang lahat ng step." },
  notDoneYet: { en: "Every step is correct so far. Keep going until x is alone.", fil: "Tama ang lahat ng step. Ituloy hanggang mag-isa ang x." },
  submit: { en: "Submit", fil: "Ipasa" },
  next: { en: "Next", fil: "Susunod" },
  engineLoading: { en: "Math checker loading…", fil: "Naglo-load ang math checker…" },
  engineReady: { en: "Math checker ready (works offline)", fil: "Handa na ang math checker (gumagana offline)" },
} satisfies Record<string, Record<Lang, string>>;

export type StringKey = keyof typeof STRINGS;

export function useT() {
  const lang = useStore((s) => s.lang);
  return (key: StringKey) => STRINGS[key][lang];
}
