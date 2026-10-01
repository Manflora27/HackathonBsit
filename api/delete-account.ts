// Erasure (RA 10173): deletes the caller's account once the session proves who they are.
// profiles.id references auth.users on delete cascade, so the profile and everything it owns
// (consents, attempts, skill_progress, memberships, owned classes) goes with it.
// The service-role key never leaves the server; the client only sends its own access token.
import { json } from "./_openrouter.js";

export async function POST(req: Request) {
  try {
    const url = process.env.SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !service) return json({ error: "account deletion not configured" }, 503);

    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return json({ error: "sign in required" }, 401);

    // Resolve the caller from their token; never trust a user id sent by the client.
    const who = await fetch(`${url}/auth/v1/user`, { headers: { apikey: service, authorization: `Bearer ${token}` } });
    if (!who.ok) return json({ error: "invalid session" }, 401);
    const { id } = (await who.json()) as { id?: string };
    if (!id) return json({ error: "invalid session" }, 401);

    const res = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { apikey: service, authorization: `Bearer ${service}` },
    });
    return res.ok ? json({ ok: true }) : json({ error: "delete failed" }, 502);
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
}
