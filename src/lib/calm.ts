import { useReducedMotion } from "motion/react";
import { useStore } from "../store";

/** True when motion should be still: the OS setting or the in-app "Reduce motion" toggle. */
export function useCalm() {
  const os = useReducedMotion();
  const pref = useStore((s) => s.reduceMotion);
  return !!os || pref;
}
