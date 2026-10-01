/**
 * One way to call Supabase: failures are logged with where they happened (never swallowed silently), and
 * transient ones (network drop, 5xx, rate limit) get two more tries with backoff.
 * Pass tries: 1 for writes that could duplicate a row if a lost response were retried.
 */

/** Log a failed remote call. One place, so a later error reporter only needs wiring here. */
export function report(where: string, error: unknown) {
  console.error(`[remote] ${where}:`, error);
}

type Answer = { error: { message: string; code?: string } | null; status?: number };

const transient = (r: Answer) =>
  !r.status || r.status >= 500 || r.status === 429 || /fetch|network|timeout|load failed/i.test(r.error?.message ?? "");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function remote<T extends Answer>(where: string, call: () => PromiseLike<T>, { tries = 3 } = {}): Promise<T> {
  for (let i = 0; ; i++) {
    let r: T;
    try {
      r = await call();
    } catch (e) {
      r = { data: null, error: { message: String(e) }, status: 0 } as unknown as T;
    }
    if (!r.error) return r;
    if (i + 1 >= tries || !transient(r)) {
      report(where, r.error);
      return r;
    }
    await sleep(400 * 3 ** i); // 0.4s, 1.2s
  }
}
