// The offline happy path: one bundled lesson, shown for every unit in every subject with the unit's title filled in.
// No network, no model. Practice keys are plain values, so grading works even before the engine has loaded.
import type { PlacementQuestion } from "../ai/client";
import type { PlanUnit, SubjectId } from "../data/curriculum";
import type { Lesson } from "../types";
import type { LessonTarget } from "./pipeline";

export function templateLesson(unit: LessonTarget): Lesson {
  const t = unit.title;
  return {
    en: {
      hook: `Let's get started with ${t}.`,
      body: [
        `Every problem in ${t} can be worked the same way: read what is given, decide what is asked, then take one small step at a time.`,
        "Write each step on its own line. If one line follows from the line before, you can trust your answer.",
        "To check, put your answer back into the problem. If both sides agree, you're done.",
      ],
      pitfall: "Whatever you do to one side of an equation, do to the other side too.",
      check: { question: "You solved 2x = 10 and got x = 5. How can you check it?", choices: ["Put 5 back in: 2 × 5 = 10", "Solve it again a different way", "Ask a friend"], why: "Putting the answer back in shows both sides are equal." },
      spoken: `Let's get started with ${t}. Read what is given, decide what is asked, then take one small step at a time. Write each step on its own line, and check by putting your answer back into the problem.`,
    },
    fil: {
      hook: `Simulan natin ang ${t}.`,
      body: [
        `Bawat problema sa ${t} ay pareho ang paraan: basahin ang ibinigay, alamin ang hinihingi, at gumawa ng isang maliit na hakbang sa bawat pagkakataon.`,
        "Isulat ang bawat hakbang sa sariling linya. Kung sumusunod ang bawat linya sa nauna, mapagkakatiwalaan mo ang sagot.",
        "Para tiyakin, ibalik ang sagot sa problema. Kapag pareho ang dalawang panig, tapos ka na.",
      ],
      pitfall: "Anuman ang gawin mo sa isang panig ng equation, gawin din sa kabila.",
      check: { question: "Nilutas mo ang 2x = 10 at nakuha ang x = 5. Paano mo ito titiyakin?", choices: ["Ibalik ang 5: 2 × 5 = 10", "Lutasin ulit sa ibang paraan", "Magtanong sa kaibigan"], why: "Kapag ibinalik ang sagot, makikita mong pantay ang dalawang panig." },
      spoken: `Simulan natin ang ${t}. Basahin ang ibinigay, alamin ang hinihingi, at gumawa ng isang maliit na hakbang sa bawat pagkakataon.`,
    },
    checkAnswer: 0,
    practice: [
      { prompt: "Solve for x", given: "3x+5=20", form: "solved", expected: "x=5" },
      { prompt: "Solve for x", given: "2(x-4)=10", form: "solved", expected: "x=9" },
      { prompt: "Solve for x", given: "x/3+2=6", form: "solved", expected: "x=12" },
    ],
    format: 3,
  };
}

type Sample = Pick<PlacementQuestion, "prompt" | "choices" | "answer">;

const MATH: Sample[] = [
  { prompt: "What is 7 × 8?", choices: ["54", "56", "64", "48"], answer: 1 },
  { prompt: "Solve: x + 9 = 15", choices: ["x = 24", "x = 6", "x = 9", "x = 5"], answer: 1 },
  { prompt: "What is 3/4 of 20?", choices: ["12", "15", "16", "5"], answer: 1 },
  { prompt: "Solve: 2x = 18", choices: ["x = 9", "x = 16", "x = 36", "x = 20"], answer: 0 },
  { prompt: "What is 25% of 80?", choices: ["25", "20", "40", "8"], answer: 1 },
];
const ADVANCED_MATH: Sample[] = [
  { prompt: "Factor: x² − 9", choices: ["(x − 3)²", "(x + 3)(x − 3)", "(x − 9)(x + 1)", "x(x − 9)"], answer: 1 },
  { prompt: "Solve: x² = 49", choices: ["x = 7", "x = ±7", "x = 24.5", "x = −7"], answer: 1 },
  { prompt: "What is the slope of y = 3x − 2?", choices: ["−2", "3", "1/3", "−3"], answer: 1 },
  { prompt: "If f(x) = 2x + 1, what is f(4)?", choices: ["7", "8", "9", "10"], answer: 2 },
  { prompt: "What is 2⁵?", choices: ["10", "25", "32", "64"], answer: 2 },
];
const SCIENCE: Sample[] = [
  { prompt: "Which part of a plant cell makes food using sunlight?", choices: ["Nucleus", "Chloroplast", "Cell wall", "Vacuole"], answer: 1 },
  { prompt: "Water boils at what temperature at sea level?", choices: ["50 °C", "90 °C", "100 °C", "120 °C"], answer: 2 },
  { prompt: "Which is a mixture?", choices: ["Pure water", "Salt water", "Oxygen gas", "Gold"], answer: 1 },
  { prompt: "What force pulls objects toward the Earth?", choices: ["Friction", "Magnetism", "Gravity", "Tension"], answer: 2 },
  { prompt: "Which planet is closest to the Sun?", choices: ["Venus", "Earth", "Mars", "Mercury"], answer: 3 },
];
const PHYSICS: Sample[] = [
  { prompt: "A car travels 100 m in 20 s. What is its speed?", choices: ["2 m/s", "5 m/s", "20 m/s", "2000 m/s"], answer: 1 },
  { prompt: "What is the unit of force?", choices: ["Joule", "Watt", "Newton", "Pascal"], answer: 2 },
  { prompt: "Rearrange v = d / t for d.", choices: ["d = v / t", "d = t / v", "d = v × t", "d = v + t"], answer: 2 },
  { prompt: "Which has more kinetic energy at the same speed?", choices: ["A 1 kg ball", "A 5 kg ball", "They're equal", "Can't tell"], answer: 1 },
  { prompt: "F = m × a. What is F when m = 2 kg and a = 3 m/s²?", choices: ["5 N", "6 N", "1.5 N", "9 N"], answer: 1 },
];
const CHEMISTRY: Sample[] = [
  { prompt: "What is the chemical formula of water?", choices: ["HO", "H₂O", "H₂O₂", "OH₂"], answer: 1 },
  { prompt: "Which particle has a negative charge?", choices: ["Proton", "Neutron", "Electron", "Nucleus"], answer: 2 },
  { prompt: "A solution with pH 2 is…", choices: ["Acidic", "Neutral", "Basic", "Salty"], answer: 0 },
  { prompt: "What is the symbol for sodium?", choices: ["S", "So", "Na", "Sd"], answer: 2 },
  { prompt: "Balance: H₂ + O₂ → H₂O. How many H₂O?", choices: ["1", "2", "3", "4"], answer: 1 },
];
const BIOLOGY: Sample[] = [
  { prompt: "What carries genetic information in cells?", choices: ["ATP", "DNA", "Glucose", "Starch"], answer: 1 },
  { prompt: "Where does respiration release energy in a cell?", choices: ["Ribosome", "Nucleus", "Mitochondrion", "Cell membrane"], answer: 2 },
  { prompt: "Which organ pumps blood around the body?", choices: ["Lungs", "Liver", "Heart", "Kidney"], answer: 2 },
  { prompt: "Plants take in which gas for photosynthesis?", choices: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], answer: 2 },
  { prompt: "A group of similar cells working together is a…", choices: ["Tissue", "Organ", "System", "Organism"], answer: 0 },
];
const EARTH: Sample[] = [
  { prompt: "What causes day and night?", choices: ["Earth's orbit", "Earth's rotation", "The Moon", "Clouds"], answer: 1 },
  { prompt: "Which layer of the Earth do we live on?", choices: ["Core", "Mantle", "Crust", "Outer core"], answer: 2 },
  { prompt: "Rock formed from cooled magma is…", choices: ["Igneous", "Sedimentary", "Metamorphic", "Fossil"], answer: 0 },
  { prompt: "What scale measures earthquake magnitude?", choices: ["Beaufort", "Richter", "Celsius", "pH"], answer: 1 },
  { prompt: "A typhoon forms over…", choices: ["Mountains", "Deserts", "Warm ocean water", "Ice sheets"], answer: 2 },
];

const SAMPLES: Record<SubjectId, Sample[]> = {
  math: MATH, "general-math": MATH,
  "finite-math": ADVANCED_MATH, "pre-calculus": ADVANCED_MATH, "advanced-math": ADVANCED_MATH, "basic-calculus": ADVANCED_MATH,
  science: SCIENCE, "general-science": SCIENCE,
  physics: PHYSICS, chemistry: CHEMISTRY, biology: BIOLOGY, "earth-space": EARTH,
};

/** The starting-point check's sample questions for a subject: multiple choice, pointed at the plan's first units. */
export function templatePlacement(units: PlanUnit[]): PlacementQuestion[] {
  const qs = SAMPLES[units[0]?.subject] ?? MATH;
  return units.length
    ? qs.map((q, i) => ({ ...q, unitId: units[Math.min(i, units.length - 1)].id, level: "current", kind: "choice", given: "", expected: "", form: "any" }))
    : [];
}
