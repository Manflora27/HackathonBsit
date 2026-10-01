import { parse } from "partial-json";

/**
 * Read a streamed /api response (see ndjson in api/_openrouter.ts). `onPartial` gets the model's JSON so far,
 * parsed leniently (unfinished strings and lists included), at most every 80ms. `onAlive` fires on every line,
 * text or a reasoning ping, for idle timeouts. Resolves to the final "done" payload, or null on error, abort,
 * or a stream that ended early.
 */
export async function readStream<T>(res: Response, onPartial: (soFar: unknown) => void, onAlive?: () => void): Promise<T | null> {
  const everyMs = 80;
  if (!res.ok || !res.body) return null;
  // A plain JSON answer (a server that doesn't stream, or a test double) is the whole stream at once.
  if (res.headers.get("content-type")?.includes("application/json")) {
    const whole = (await res.json()) as T & { error?: string };
    if (whole.error) return null;
    onPartial(whole);
    return whole;
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  let text = "";
  let shown = 0;
  let last = 0;
  const show = () => {
    if (text.length === shown) return;
    shown = text.length;
    last = Date.now();
    try { onPartial(parse(text)); } catch { /* not enough to read yet */ }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return null;
    buf += value;
    const lines = buf.split("\n");
    buf = lines.pop()!;
    for (const line of lines) {
      if (!line) continue;
      const m = JSON.parse(line) as { t: "text"; d: string } | { t: "alive" } | ({ t: "done" } & T) | { t: "error"; error: string };
      onAlive?.();
      if (m.t === "alive") continue;
      if (m.t === "text") text += m.d;
      else if (m.t === "done") {
        show();
        const { t: _t, ...rest } = m;
        return rest as unknown as T;
      } else {
        console.warn(`[stream] ${m.error}`);
        return null;
      }
    }
    if (Date.now() - last >= everyMs) show();
  }
}

/** Streamed text can stop inside $...$ math or **bold**: cut the unfinished formula and close the bold, so it never renders broken. */
export function cleanPartial(s: string): string {
  let cut = s.endsWith("\\") ? s.slice(0, -1) : s;
  if ((cut.split("$$").length - 1) % 2) cut = cut.slice(0, cut.lastIndexOf("$$"));
  const singles = cut.replace(/\$\$/g, "  ");
  if ((singles.split("$").length - 1) % 2) cut = cut.slice(0, singles.lastIndexOf("$"));
  cut = cut.trimEnd();
  return (cut.split("**").length - 1) % 2 ? cut + "**" : cut;
}
