// Pushes Hopper's branded auth emails to the Supabase project.
// Needs a personal access token: SUPABASE_ACCESS_TOKEN=sbp_... node scripts/push-email-templates.mjs
// (create one at https://supabase.com/dashboard/account/tokens)
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  [".env.local", ".env"].flatMap((f) => {
    try {
      return readFileSync(f, "utf8").split("\n").map((l) => l.match(/^([A-Z_]+)=(.*)$/)?.slice(1)).filter(Boolean);
    } catch {
      return [];
    }
  }),
);
const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = (process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL)?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!token) throw new Error("Set SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens)");
if (!ref) throw new Error("Couldn't find VITE_SUPABASE_URL in the environment or .env");

const html = readFileSync(new URL("../supabase/templates/magic-link.html", import.meta.url), "utf8");
// New emails get the "confirm signup" message, returning ones the magic link; to the learner both are "tap to sign in".
const body = {
  mailer_subjects_magic_link: "Your Hopper sign-in link",
  mailer_templates_magic_link_content: html,
  mailer_subjects_confirmation: "Your Hopper sign-in link",
  mailer_templates_confirmation_content: html,
};

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
if (!res.ok) throw new Error(`Supabase said ${res.status}: ${await res.text()}`);
console.log(`Branded auth emails pushed to ${ref}.`);
