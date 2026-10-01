import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useT } from "../i18n";

/**
 * Math symbols the phone keyboard hides, in one slim row that rides just above it.
 * Shown while any <input data-math> has focus; works with every page's controlled inputs
 * by inserting at the caret and firing a native input event, so React's onChange runs as if typed.
 * Mounted once (in Shell).
 */
const KEYS: { label: string; insert: string; aria?: string }[] = [
  { label: "^", insert: "^", aria: "power" },
  { label: "²", insert: "^2", aria: "squared" },
  { label: "√", insert: "sqrt(", aria: "square root" },
  { label: "(", insert: "(" },
  { label: ")", insert: ")" },
  { label: "/", insert: "/", aria: "divided by" },
  { label: "=", insert: "=" },
  { label: "±", insert: "±", aria: "plus or minus" },
  { label: "or", insert: " or " },
];

const isMath = (el: Element | null): el is HTMLInputElement => el instanceof HTMLInputElement && el.dataset.math !== undefined;

function insertAt(el: HTMLInputElement, text: string) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const value = el.value.slice(0, start) + text + el.value.slice(end);
  // React tracks the value through the prototype setter; set it there, then announce the change.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  const caret = start + text.length;
  el.setSelectionRange(caret, caret);
}

export function MathStrip() {
  const t = useT();
  const [target, setTarget] = useState<HTMLInputElement | null>(null);
  const [bottom, setBottom] = useState(0);

  useEffect(() => {
    const onFocus = () => setTarget(isMath(document.activeElement) ? document.activeElement : null);
    // Blur fires before the next focus; wait a tick so moving between answer boxes doesn't flicker.
    const onBlur = () => setTimeout(onFocus, 0);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
    };
  }, []);

  // Sit on top of the on-screen keyboard: the visual viewport shrinks when it opens.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const place = () => setBottom(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    place();
    vv.addEventListener("resize", place);
    vv.addEventListener("scroll", place);
    return () => {
      vv.removeEventListener("resize", place);
      vv.removeEventListener("scroll", place);
    };
  }, []);

  // Same dark glass pill as the tab bar, so the bottom of the screen always looks like one piece.
  return (
    <AnimatePresence>
      {target && (
        <motion.div key="strip" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} transition={{ duration: 0.18 }}
          className="fixed inset-x-0 z-40 mx-auto max-w-md px-3 pb-2" style={{ bottom }} data-testid="math-strip">
          <div className="glass-dark flex gap-1 overflow-x-auto rounded-full p-1.5 text-paper" role="toolbar" aria-label={t("keypad.label")}>
            {KEYS.map((k) => (
              <button key={k.label} type="button" aria-label={k.aria ?? k.label}
                // Keep focus (and the keyboard) on the input.
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => insertAt(target, k.insert)}
                className={`h-10 min-w-9 flex-1 rounded-full font-mono font-semibold transition duration-75 active:scale-90 active:bg-white/90 active:text-ink ${
                  k.label === "or" ? "text-[14px] text-paper/80" : "text-[18px]"} bg-white/[.07]`}>
                {k.label}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
