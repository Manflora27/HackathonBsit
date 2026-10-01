/**
 * Where Bilog's eyes point. One shared loop for every instance on the page:
 * it runs only while something is moving, writes the eye transform directly
 * (no React renders), and skips characters that are off screen.
 *
 * What an instance looks at, in order:
 *   1. the text field being typed in (follows the end of the text),
 *   2. the pointer, for a short while after it last moved or tapped,
 *   3. a fixed direction (the character's mood decides, e.g. "down" while digging),
 *   4. an element the page points it at (the circled term, the root node),
 *   5. straight ahead.
 */

type Vec = { x: number; y: number };

export interface Looker {
  setFixed(dir: Vec | null): void;
  setTarget(el: Element | null): void;
  dispose(): void;
}

interface Watcher {
  eyes: SVGGElement;
  anchor: Element;
  root: Element;
  range: Vec;
  fixed: Vec | null;
  target: Element | null;
  cx: number;
  cy: number;
  x: number;
  y: number;
  visible: boolean;
}

const watchers = new Set<Watcher>();
let pointer: { x: number; y: number; t: number; touch: boolean } | null = null;
let rectsDirty = true;
let raf = 0;
let listening = false;
let io: IntersectionObserver | null = null;
const byRoot = new Map<Element, Watcher>();

const HOLD_MOUSE = 2600;
const HOLD_TOUCH = 1400;

function schedule() {
  if (!raf && !document.hidden) raf = requestAnimationFrame(tick);
}

function pointerLive(now: number) {
  return !!pointer && now - pointer.t < (pointer.touch ? HOLD_TOUCH : HOLD_MOUSE);
}

function typingPoint(): Vec | null {
  const el = document.activeElement;
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return null;
  const r = el.getBoundingClientRect();
  if (!r.width) return null;
  // Approximate the caret: the end of what's been typed.
  const fontPx = parseFloat(getComputedStyle(el).fontSize) || 16;
  const x = r.left + Math.min(r.width - 8, 14 + el.value.length * fontPx * 0.58);
  return { x, y: r.top + r.height / 2 };
}

function aim(w: Watcher, now: number, typing: Vec | null): Vec {
  let p: Vec | null = typing;
  if (!p && pointerLive(now)) p = pointer;
  if (!p && w.fixed) return { x: w.fixed.x * w.range.x, y: w.fixed.y * w.range.y };
  if (!p && w.target?.isConnected) {
    const r = w.target.getBoundingClientRect();
    p = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  if (!p) return { x: 0, y: 0 };
  const dx = p.x - w.cx;
  const dy = p.y - w.cy;
  const d = Math.hypot(dx, dy) || 1;
  const k = Math.min(1, d / 200); // close targets get a smaller glance
  return { x: (dx / d) * k * w.range.x, y: (dy / d) * k * w.range.y };
}

function tick() {
  raf = 0;
  const now = performance.now();
  const typing = typingPoint();
  let moving = false;
  for (const w of watchers) {
    if (!w.visible) continue;
    if (rectsDirty) {
      const r = w.anchor.getBoundingClientRect();
      w.cx = r.left + r.width / 2;
      w.cy = r.top + r.height / 2;
    }
    const t = aim(w, now, typing);
    const nx = w.x + (t.x - w.x) * 0.2;
    const ny = w.y + (t.y - w.y) * 0.2;
    if (Math.abs(t.x - nx) + Math.abs(t.y - ny) > 0.04) moving = true;
    w.x = nx;
    w.y = ny;
    w.eyes.setAttribute("transform", `translate(${nx.toFixed(2)} ${ny.toFixed(2)})`);
  }
  rectsDirty = false;
  // Keep running while easing, and while a recent pointer could still expire back to the fallback.
  if (moving || pointerLive(now)) schedule();
}

function onPointer(e: PointerEvent) {
  pointer = { x: e.clientX, y: e.clientY, t: performance.now(), touch: e.pointerType !== "mouse" };
  schedule();
}
function onLayout() {
  rectsDirty = true;
  schedule();
}

function listen() {
  if (listening) return;
  listening = true;
  const opts = { passive: true } as const;
  window.addEventListener("pointermove", onPointer, opts);
  window.addEventListener("pointerdown", onPointer, opts);
  window.addEventListener("scroll", onLayout, { passive: true, capture: true });
  window.addEventListener("resize", onLayout, opts);
  document.addEventListener("focusin", onLayout);
  document.addEventListener("focusout", onLayout);
  document.addEventListener("input", onLayout);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else onLayout();
  });
  io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const w = byRoot.get(e.target);
      if (!w) continue;
      w.visible = e.isIntersecting;
      // Pause the CSS idle animations (blink, spin) while off screen.
      e.target.toggleAttribute("data-off", !e.isIntersecting);
    }
    onLayout();
  });
}

/** Register a pair of eyes. `range` is how far (in SVG units) the eyes may travel. */
export function watch(root: Element, eyes: SVGGElement, anchor: Element, range: Vec): Looker {
  listen();
  const w: Watcher = { eyes, anchor, root, range, fixed: null, target: null, cx: 0, cy: 0, x: 0, y: 0, visible: true };
  watchers.add(w);
  byRoot.set(root, w);
  io?.observe(root);
  onLayout();
  return {
    setFixed(dir) {
      w.fixed = dir;
      schedule();
    },
    setTarget(el) {
      w.target = el;
      schedule();
    },
    dispose() {
      watchers.delete(w);
      byRoot.delete(root);
      io?.unobserve(root);
    },
  };
}
