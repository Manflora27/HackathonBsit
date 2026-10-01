import { buildPlan, type SubjectId } from "../data/curriculum";
import { getLesson, unitTarget } from "./pipeline";
import { deviceKeys } from "./store";

/** Lessons already on this device for a subject and grade, out of the plan's total. */
export async function packStatus(subject: SubjectId, grade: number) {
  const units = buildPlan(subject, grade);
  const have = new Set(await deviceKeys());
  return { have: units.filter((u) => have.has(u.id)).length, total: units.length };
}

/** Prepare every lesson in the plan for offline use. Uncached lessons are generated and verified, 2 at a time. */
export async function downloadPack(subject: SubjectId, grade: number, onProgress: (done: number, total: number) => void) {
  const units = buildPlan(subject, grade);
  const have = new Set(await deviceKeys());
  const todo = units.filter((u) => !have.has(u.id));
  let done = units.length - todo.length;
  let failed = 0;
  onProgress(done, units.length);
  const queue = [...todo];
  const worker = async () => {
    for (let u = queue.shift(); u; u = queue.shift()) {
      const r = await getLesson(unitTarget(u));
      if (r) done++;
      else failed++;
      onProgress(done, units.length);
    }
  };
  await Promise.all([worker(), worker()]);
  return { done, failed, total: units.length };
}
