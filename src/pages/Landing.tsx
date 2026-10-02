import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Bilog } from "../components/Bilog";
import { Icon } from "../components/Icon";
import { Shell } from "../components/Shell";
import { MOCK_AUTH, useAuth } from "../auth";
import { signInAvailable } from "../lib/supabase";
import { useStore } from "../store";
import { useT } from "../i18n";

type StoryId = "math" | "physics" | "chemistry";
type Story = {
  /** catalog keys live under landing.stories.<id> */
  id: StoryId;
  /** symbols on the foundation → gap → current-skill nodes, top-left to bottom */
  nodes: [string, string, string];
  shape: Shape;
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
    extras: [{ at: [236, 58] }, { at: [284, 128], done: true }, { at: [56, 186], done: true }, { at: [112, 206], done: true }],
    edges: ["M36 34 C100 26 190 40 236 58", "M236 58 C262 76 280 100 284 128", "M120 96 C96 130 64 150 56 186", "M228 176 C190 200 140 210 112 206"],
  },
  molecule: {
    top: [19, 34], gap: [62, 128], end: [176, 166],
    extras: [{ at: [150, 40] }, { at: [244, 116], done: true }, { at: [266, 194], done: true }, { at: [20, 200], done: true }],
    edges: ["M36 34 C80 30 120 34 150 40", "M150 40 C190 50 230 80 244 116", "M176 166 C200 150 226 130 244 116", "M176 166 C210 176 246 184 266 194", "M62 128 C44 150 26 176 20 200"],
  },
};

const STORIES: Story[] = [
  { id: "math", nodes: ["x", "sin", "∫"], shape: SHAPES.tree },
  { id: "physics", nodes: ["a/b", "v=", "→"], shape: SHAPES.stairs },
  { id: "chemistry", nodes: ["H", "2H", "⇌"], shape: SHAPES.molecule },
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
        background: `radial-gradient(40% 40% at ${gapX}% ${gapY}%, color-mix(in oklab, var(--color-gap) 14%, transparent), transparent 70%), radial-gradient(60% 55% at 50% 50%, rgb(255 253 247 / .75), transparent 72%)`,
        transition: "background .6s",
      }}>
      <RootDrawing key={story.id} story={story} />
      {/* invisible anchor over the gap node, for Bilog's eyes */}
      <span ref={rootRef} className="absolute h-2 w-2" style={{ left: `${gapX}%`, top: `${gapY}%` }} aria-hidden />
      <div className="pointer-events-none absolute -top-1 right-0">
        <Bilog size={40} mood={drawn ? "found" : "watch"} lookAt={rootRef} />
      </div>
    </div>
  );
}

/** Thin-line drawing of a skill graph, traced from the foundation to the gap. */
function RootDrawing({ story }: { story: Story }) {
  const t = useT();
  const labels = [t(`landing.stories.${story.id}.top`), t(`landing.stories.${story.id}.gap`), t(`landing.stories.${story.id}.end`)];
  const [top, gap, end] = story.nodes;
  const { top: [tx, ty], gap: [gx, gy], end: [ex, ey], extras, edges } = story.shape;
  const tr = (d: number) => ({ duration: 0.9, delay: d, ease: "easeInOut" as const });
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
        strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={tr(0.3)} />
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
        <motion.g initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={tr(1.1)} style={{ transformOrigin: "150px 182px" }}>
          <circle cx="150" cy="182" r="17" fill="var(--color-gap)" />
          <text x="150" y={182 + sym(gap) / 3} textAnchor="middle" fontFamily="Young Serif" fontSize={sym(gap)} fill="#fff">{gap}</text>
        </motion.g>
        <motion.path d="M128 172 C 132 152, 172 150, 176 176 C 180 202, 136 210, 126 190 C 122 180, 128 168, 140 163" fill="none" stroke="var(--color-gap)"
          strokeWidth="1.8" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={tr(1.5)} />
      </g>
      <g fontFamily="inherit" fontSize="11" letterSpacing=".04em">
        <text x={tx + 25} y={ty + 4} fill="var(--color-muted)">{labels[0]}</text>
        <motion.text x={gx + 36} y={gy + 5} fill="var(--color-gap-dark)" fontWeight="600"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={tr(2.2)}>{labels[1]}</motion.text>
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
  const { consent, set } = useStore();
  const by = "school" as const;
  // Continuing is the consent: the line under the buttons says so, and tapping one records it.
  const agreeNow = () => { if (!consent) set({ consent: { by, at: Date.now() } }); };
  const t = useT();
  const story = useStory();
  const say = { end: t(`landing.stories.${story.id}.endShort`), gap: t(`landing.stories.${story.id}.gapShort`) };
  const swap = (text: string, key = text) => (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span key={key} className="inline-block" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
        {text}
      </motion.span>
    </AnimatePresence>
  );
  const word = swap(t(`landing.stories.${story.id}.word`));

  const { user, profile, ready, error, signInGoogle, signInEmail } = useAuth();
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const sendLink = async () => {
    agreeNow();
    setSending(true);
    if (await signInEmail(email)) setSentTo(email.trim());
    setSending(false);
  };

  useEffect(() => {
    if (!ready || !user) return;
    // Signed in (here, or through an email link opened elsewhere): continuing to sign in was the consent.
    if (!consent) set({ consent: { by: "self", at: Date.now() } });
    if (!profile?.onboarded_at) return void nav("/welcome", { replace: true });
    set({ role: "student", demo: false });
    nav("/student", { replace: true });
  }, [consent, ready, user, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Shell tabs={false} bare>
      <div className="flex min-h-[calc(100dvh-4.5rem)] flex-col">
        <div className="-mt-8 flex h-9 items-center gap-2 pr-14">
          <img src="/icon.svg" alt="" className="h-7 w-7 rounded-[9px]" />
          <span className="font-display text-[18px]">Hopper</span>
        </div>

        <div className="mt-4 flex flex-col" style={{ height: "clamp(140px, min(calc((min(100vw, 448px) - 2rem) * 0.76), calc(100dvh - 500px)), 380px)" }}>
          <HeroDrawing story={story} />
        </div>

        <div className="min-h-4 flex-[2]" />

        <section>
          <div className="kicker text-gap-dark">{t.rich("landing.stuckOn", { subject: word })}</div>
          <h1 className="mt-2 whitespace-nowrap text-[clamp(20px,min(3.8dvh,5.6vw),32px)] leading-[1.15]">
            {t.rich("landing.notBadAt", { skill: swap(say.end) })}
            <br />
            {t("landing.missing")}
            <span className="mt-2 block pl-1">
              <PenBox key={story.id} className="px-3 pb-1.5 pt-1 text-gap">{say.gap}</PenBox>
            </span>
          </h1>
          <p className="mt-3 text-[clamp(15px,2dvh,17px)] leading-snug text-muted">
            {t("landing.subtext")}
          </p>
        </section>

        <div className="min-h-6 flex-[3]" />

        <section>
            {signInAvailable ? (
              <>
                <button className="btn-primary w-full !py-4 text-[17px]" onClick={() => { agreeNow(); void signInGoogle(); }} disabled={!ready} data-testid="google-signin">
                  <GoogleMark /> {t("landing.continueGoogle")}
                </button>
                {sentTo ? (
                  <p className="mt-3 text-center text-[14px] leading-snug text-muted" data-testid="email-sent">
                    {t.rich("landing.checkInbox", { email: <span className="font-semibold text-ink">{sentTo}</span> })}{" "}
                    <button className="underline decoration-dotted underline-offset-4" onClick={() => setSentTo(null)}>{t("landing.useAnotherEmail")}</button>
                  </p>
                ) : showEmail ? (
                  <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void sendLink(); }}>
                    <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("landing.emailPlaceholder")}
                      autoComplete="email" inputMode="email" data-testid="email-input"
                      className="min-w-0 flex-1 rounded-full border border-white/65 bg-white/60 px-5 text-[16px] outline-none transition focus:border-ink/40" />
                    <button className="btn-ghost shrink-0" disabled={sending || !email.includes("@")} data-testid="email-send">
                      {sending ? (t("landing.sending")) : t("landing.sendLink")}
                    </button>
                  </form>
                ) : (
                  <button className="mx-auto mt-3 flex min-h-10 items-center gap-1.5 text-[14.5px] text-muted underline decoration-dotted underline-offset-4 disabled:opacity-40"
                    onClick={() => { agreeNow(); setShowEmail(true); }} disabled={!ready} data-testid="email-signin">
                    <Icon name="mail" size={16} /> {t("landing.continueEmail")}
                  </button>
                )}
              </>
            ) : (
              <p className="rounded-2xl bg-gap-soft/70 px-3 py-2 text-[13px] text-gap-dark" data-testid="auth-unconfigured">
                {t("landing.signIsntConnectedYet")}
              </p>
            )}
            {error && <p className="mt-3 text-[14px] text-gap-dark">{error}</p>}
            <p className="mt-4 text-center text-[12px] leading-snug text-muted" data-testid="consent-note">{t("landing.consent")}</p>
            {MOCK_AUTH && (
              <p className="mt-2 text-center text-[11px] text-muted" data-testid="test-mode">
                <span className="mr-1.5 rounded-full border border-dashed border-ink/30 px-2 py-0.5 font-semibold text-ink/70">DEV</span>
                {t("landing.testMode")}
              </p>
            )}
          </section>
      </div>
    </Shell>
  );
}
