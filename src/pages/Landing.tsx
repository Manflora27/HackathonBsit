import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Bilog } from "../components/Bilog";
import { Icon } from "../components/Icon";
import { Shell } from "../components/Shell";
import { useAuth } from "../auth";
import { authConfigured } from "../lib/supabase";
import { useStore } from "../store";

type Story = {
  word: { en: string; fil: string };
  /** foundation → gap → where the student is stuck, top-left to bottom */
  nodes: [string, string, string];
  labels: { en: [string, string, string]; fil: [string, string, string] };
  shape: Shape;
  /** the headline: "You're not bad at {end}. You're missing {gap}." */
  say: { en: { end: string; gap: string }; fil: { end: string; gap: string } };
};

type Pt = [number, number];
/** Node positions in a 300×228 box. top → gap → end is the traced path; extras are the rest of the graph. */
type Shape = { top: Pt; gap: Pt; end: Pt; extras: { at: Pt; done?: boolean }[]; edges: string[] };

const SHAPES: Record<"tree" | "stairs" | "molecule", Shape> = {
  tree: {
    top: [19, 34], gap: [92, 112], end: [160, 190],
    extras: [{ at: [262, 72] }, { at: [48, 190], done: true }, { at: [246, 190], done: true }, { at: [286, 186], done: true }],
    edges: ["M33 45 C80 74 200 50 262 72", "M92 112 C70 140 52 160 48 190", "M262 72 C270 120 284 150 286 186", "M262 72 C262 124 248 160 246 190"],
  },
  stairs: {
    top: [19, 34], gap: [120, 96], end: [228, 176],
    extras: [{ at: [250, 34] }, { at: [284, 118], done: true }, { at: [56, 186], done: true }, { at: [112, 206], done: true }],
    edges: ["M36 34 C100 20 200 22 250 34", "M250 34 C272 60 284 90 284 118", "M120 96 C96 130 64 150 56 186", "M228 176 C190 200 140 210 112 206"],
  },
  molecule: {
    top: [19, 34], gap: [62, 128], end: [176, 166],
    extras: [{ at: [150, 40] }, { at: [244, 116], done: true }, { at: [266, 194], done: true }, { at: [20, 200], done: true }],
    edges: ["M36 34 C80 30 120 34 150 40", "M150 40 C190 50 230 80 244 116", "M176 166 C200 150 226 130 244 116", "M176 166 C210 176 246 184 266 194", "M62 128 C44 150 26 176 20 200"],
  },
};

const STORIES: Story[] = [
  {
    word: { en: "math", fil: "math" },
    nodes: ["x", "x,y", "∫"],
    labels: {
      en: ["Algebra", "Systems of equations", "Integrals (calculus)"],
      fil: ["Algebra", "Sistema ng mga equation", "Integral (calculus)"],
    },
    shape: SHAPES.tree,
    say: { en: { end: "integrals", gap: "systems of equations" }, fil: { end: "integral", gap: "sistema ng equation" } },
  },
  {
    word: { en: "physics", fil: "physics" },
    nodes: ["a/b", "v=", "→"],
    labels: {
      en: ["Fractions", "Rearranging formulas", "Kinematics (physics)"],
      fil: ["Fractions", "Pag-ayos ng formula", "Kinematics (physics)"],
    },
    shape: SHAPES.stairs,
    say: { en: { end: "kinematics", gap: "rearranging formulas" }, fil: { end: "kinematics", gap: "pag-ayos ng formula" } },
  },
  {
    word: { en: "chemistry", fil: "chemistry" },
    nodes: ["H", "2H", "⇌"],
    labels: {
      en: ["Atoms", "Balancing equations", "Reactions (chemistry)"],
      fil: ["Atom", "Pag-balance ng equation", "Reaksyon (chemistry)"],
    },
    shape: SHAPES.molecule,
    say: { en: { end: "reactions", gap: "balancing equations" }, fil: { end: "reaksyon", gap: "pag-balance ng equation" } },
  },
];

const STORY_MS = 6500; // ~2.5s to draw and circle the gap, then a hold

function useStory() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % STORIES.length), STORY_MS);
    return () => clearInterval(id);
  }, []);
  return STORIES[i];
}

/** Bilog watches the drawing trace down, and lights up when the gap gets circled. */
function HeroDrawing({ story }: { story: Story }) {
  const [drawn, setDrawn] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const gapX = Math.round((story.shape.gap[0] / 300) * 100);
  const gapY = Math.round((story.shape.gap[1] / 228) * 100);
  useEffect(() => {
    setDrawn(false);
    const id = setTimeout(() => setDrawn(true), 2300); // when the drawing circles the gap
    return () => clearTimeout(id);
  }, [story]);
  return (
    <div className="relative min-h-[150px] flex-1"
      style={{
        background: `radial-gradient(40% 40% at ${gapX}% ${gapY}%, color-mix(in oklab, var(--color-gap) 22%, transparent), transparent 70%), radial-gradient(60% 55% at 50% 50%, rgb(255 253 247 / .75), transparent 72%)`,
        transition: "background .6s",
      }}>
      <RootDrawing key={story.word.en} story={story} />
      {/* invisible anchor over the gap node, for Bilog's eyes */}
      <span ref={rootRef} className="absolute h-2 w-2" style={{ left: `${gapX}%`, top: `${gapY}%` }} aria-hidden />
      <div className="pointer-events-none absolute right-2 top-[12%]">
        <Bilog size={46} mood={drawn ? "found" : "watch"} lookAt={rootRef} />
      </div>
    </div>
  );
}

/** Thin-line drawing of a skill graph, traced from the foundation to the gap. */
function RootDrawing({ story }: { story: Story }) {
  const fil = useStore((s) => s.lang) === "fil";
  const labels = fil ? story.labels.fil : story.labels.en;
  const [top, gap, end] = story.nodes;
  const { top: [tx, ty], gap: [gx, gy], end: [ex, ey], extras, edges } = story.shape;
  const t = (d: number) => ({ duration: 0.9, delay: d, ease: "easeInOut" as const });
  const sym = (label: string) => (label.length === 1 ? 18 : label.length === 2 ? 14 : 12);
  const traced = `M${tx} ${ty} C${tx} ${ty + 46} ${gx - 34} ${gy - 18} ${gx} ${gy}`;
  return (
    <motion.svg viewBox="0 0 300 228" preserveAspectRatio="xMinYMid meet" className="absolute inset-0 h-full w-full" aria-hidden
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <g fill="none" stroke="var(--color-ink)" strokeWidth="1.3" strokeLinecap="round" opacity=".28">
        <path d={traced} />
        <path d={`M${gx} ${gy} C${gx + 14} ${gy + 44} ${ex - 44} ${ey + 4} ${ex} ${ey}`} />
        {edges.map((d) => <path key={d} d={d} />)}
      </g>
      <motion.path d={traced} fill="none" stroke="var(--color-gap)" strokeWidth="2.4"
        strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={t(0.3)} />
      {extras.map(({ at: [x, y], done }) => (
        <circle key={`${x},${y}`} cx={x} cy={y} r={9} fill={done ? "var(--color-ok)" : "var(--color-card)"} stroke="var(--color-ink)" strokeOpacity=".3" strokeWidth="1.3" />
      ))}
      {([[tx, ty, top], [ex, ey, end]] as const).map(([x, y, label]) => (
        <g key={label}>
          <circle cx={x} cy={y} r={17} fill="var(--color-card)" stroke="var(--color-ink)" strokeOpacity=".3" strokeWidth="1.3" />
          <text x={x} y={y + sym(label) / 3} textAnchor="middle" fontFamily="Young Serif" fontSize={sym(label)} fill="var(--color-ink)">{label}</text>
        </g>
      ))}
      <g transform={`translate(${gx - 150} ${gy - 182})`}>
        <motion.g initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={t(1.1)} style={{ transformOrigin: "150px 182px" }}>
          <circle cx="150" cy="182" r="17" fill="var(--color-gap)" />
          <text x="150" y={182 + sym(gap) / 3} textAnchor="middle" fontFamily="Young Serif" fontSize={sym(gap)} fill="#fff">{gap}</text>
        </motion.g>
        <motion.path d="M128 172 C 132 152, 172 150, 176 176 C 180 202, 136 210, 126 190 C 122 180, 128 168, 140 163" fill="none" stroke="var(--color-gap)"
          strokeWidth="1.8" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={t(1.5)} />
      </g>
      <g fontFamily="inherit" fontSize="11" letterSpacing=".04em">
        <text x={tx + 25} y={ty + 4} fill="var(--color-muted)">{labels[0]}</text>
        <motion.text x={gx + 36} y={gy + 5} fill="var(--color-gap-dark)" fontWeight="600"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={t(2.2)}>{labels[1]}</motion.text>
        <text x={ex} y={ey + 34} textAnchor="middle" fill="var(--color-muted)">{labels[2]}</text>
      </g>
    </motion.svg>
  );
}

/** A rounded box sketched around its text in one pen stroke, overshooting where it closes. */
function PenBox({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState<[number, number] | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize([el.offsetWidth, el.offsetHeight]);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  let d = "";
  if (size) {
    const [w, h] = size;
    const x0 = 2, y0 = 2, x1 = w - 2, y1 = h - 2, r = Math.min(14, h / 2 - 2);
    d = `M${x0 + r + 8} ${y0 + 1.5} L${x1 - r} ${y0 - 0.5} Q${x1} ${y0} ${x1 + 0.6} ${y0 + r} L${x1 - 0.4} ${y1 - r}`
      + ` Q${x1} ${y1 + 0.5} ${x1 - r} ${y1 + 0.8} L${x0 + r} ${y1} Q${x0} ${y1} ${x0 + 0.5} ${y1 - r}`
      + ` L${x0 - 0.3} ${y0 + r + 1} Q${x0} ${y0 - 0.5} ${x0 + r + 1} ${y0} L${x0 + r + 26} ${y0 - 2}`;
  }
  return (
    <span ref={ref} className={`relative inline-block ${className}`}>
      {children}
      {size && (
        <svg className="pointer-events-none absolute inset-0 overflow-visible" width={size[0]} height={size[1]} aria-hidden>
          <motion.path d={d} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.15, ease: [0.4, 0, 0.2, 1] }} />
        </svg>
      )}
    </span>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#fff" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3zM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.600 0-4.800-1.800-5.600-4.100H3.100v2.600A10 10 0 0 0 12 22zM6.400 13.900a6 6 0 0 1 0-3.800V7.500H3.100a10 10 0 0 0 0 9zM12 5.900c1.500 0 2.800.5 3.800 1.500l2.900-2.900A10 10 0 0 0 3.100 7.500l3.300 2.600C7.200 7.700 9.400 5.900 12 5.900z"/>
    </svg>
  );
}

export default function Landing() {
  const nav = useNavigate();
  const { consent, set, lang } = useStore();
  const by = "school" as const;
  const [agree, setAgree] = useState(false);
  const fil = lang === "fil";
  const story = useStory();
  const say = fil ? story.say.fil : story.say.en;
  const swap = (text: string, key = text) => (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span key={key} className="inline-block" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
        {text}
      </motion.span>
    </AnimatePresence>
  );
  const word = swap(fil ? story.word.fil : story.word.en);

  const { user, profile, ready, error, signInGoogle } = useAuth();

  useEffect(() => {
    if (!consent || !ready || !user) return;
    if (!profile) return void nav("/welcome", { replace: true });
    set({ role: profile.account_type === "teacher" ? "teacher" : "student", demo: false });
    nav(profile.account_type === "teacher" ? "/teacher" : "/student", { replace: true });
  }, [consent, ready, user, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Shell tabs={false} bare>
      <div className="flex min-h-[calc(100dvh-4.5rem)] flex-col">
        <div className="-mt-8 flex h-9 items-center gap-2 pr-14">
          <img src="/icon.svg" alt="" className="h-7 w-7 rounded-[9px]" />
          <span className="font-display text-[18px]">Hopper</span>
        </div>

        <div className="mt-3 flex flex-1 flex-col"><HeroDrawing story={story} /></div>

        <section className="mt-6">
          <div className="kicker text-gap-dark">{fil ? <>Para sa {word} na nakakalito</> : <>A diagnostic for {word}</>}</div>
          <h1 className="mt-2 whitespace-nowrap text-[clamp(20px,min(3.8dvh,5.6vw),32px)] leading-[1.15]">
            {fil ? "Hindi ka mahina sa " : "You're not bad at "}{swap(say.end)}.
            <br />
            {fil ? "Kulang ka lang sa" : "You're missing"}
            <span className="mt-2 block pl-1">
              <PenBox key={story.word.en} className="px-3 pb-1.5 pt-1 text-gap">{say.gap}</PenBox>
            </span>
          </h1>
          <p className="mt-3 text-[clamp(15px,2dvh,17px)] leading-snug text-muted">
            {fil
              ? "Ipakita ang sagot mo. Hahanapin namin kung saan ka nagkamali, at ang naunang skill na kulang sa iyo."
              : "Show us your work. We find where it went wrong, and the earlier skill you're missing."}
          </p>
        </section>

        {!consent ? (
          <section className="mt-7">
            <label className="flex items-start gap-3 text-[13px] leading-snug text-muted">
              <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#1e2b27]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>
                {fil
                  ? "Pumapayag ako na gamitin ang work ko para hanapin ang gaps ko. Hindi nakikita ng AI ang pangalan ko, at mabubura ko ang data ko anumang oras. (RA\u00a010173)"
                  : "I agree to my work being used to find my gaps. The AI never sees my name, and I can delete my data anytime. (RA\u00a010173)"}
              </span>
            </label>
            <button className="btn-primary mt-4 w-full !py-4 text-[17px]" disabled={!agree} onClick={() => set({ consent: { by, at: Date.now() } })}>
              {fil ? "Tara na" : "Let's go"} <Icon name="arrow" size={18} />
            </button>
          </section>
        ) : (
          <section className="mt-7">
            {authConfigured ? (
              <button className="btn-primary w-full !py-4 text-[17px]" onClick={signInGoogle} disabled={!ready} data-testid="google-signin">
                <GoogleMark /> {fil ? "Magpatuloy gamit ang Google" : "Continue with Google"}
              </button>
            ) : (
              <p className="rounded-2xl bg-gap-soft/70 px-3 py-2 text-[13px] text-gap-dark" data-testid="auth-unconfigured">
                {fil ? "Hindi pa nakakonekta ang sign-in." : "Sign-in isn't connected yet (add the Supabase keys)."}
              </p>
            )}
            {error && <p className="mt-3 text-[14px] text-gap-dark">{error}</p>}
          </section>
        )}
      </div>
    </Shell>
  );
}
