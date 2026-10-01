import { headers, json, OPENROUTER_BASE } from "./_openrouter.js";

const MODEL = process.env.OPENROUTER_TTS_MODEL ?? "openai/gpt-4o-mini-tts-2025-12-15";
const VOICE = process.env.OPENROUTER_TTS_VOICE ?? "alloy";

// Reads the plain "spoken" text of an explanation (never raw LaTeX) as MP3.
export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    const res = await fetch(`${OPENROUTER_BASE}/audio/speech`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ model: MODEL, voice: VOICE, input: String(text).slice(0, 1200), response_format: "mp3" }),
    });
    if (!res.ok) return json({ error: `tts ${res.status}` }, 502);
    return new Response(res.body, {
      headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=31536000, immutable" },
    });
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
}
