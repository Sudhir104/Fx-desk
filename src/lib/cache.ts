const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
type Entry<T> = { v: T; t: number };
const store = new Map<string, Entry<unknown>>();

export type Cached<T> = { value: T | null; stale: boolean; error?: string; fetchedAt?: string };

/** In-memory TTL cache with stale-if-error: a failing upstream never blanks the page if we already have data. */
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<Cached<T>> {
  const e = store.get(key) as Entry<T> | undefined;
  const now = Date.now();
  if (e && now - e.t < ttlMs) return { value: e.v, stale: false, fetchedAt: new Date(e.t).toISOString() };
  try {
    const v = await fn();
    store.set(key, { v, t: now });
    return { value: v, stale: false, fetchedAt: new Date(now).toISOString() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (e) return { value: e.v, stale: true, error: msg, fetchedAt: new Date(e.t).toISOString() };
    return { value: null, stale: false, error: msg };
  }
}

export async function getText(url: string, opts?: { headers?: Record<string, string>; timeout?: number }): Promise<string> {
  const r = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": UA, Accept: "*/*", ...(opts?.headers ?? {}) },
    signal: AbortSignal.timeout(opts?.timeout ?? 9000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${new URL(url).host}`);
  return r.text();
}

export const isoDaysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
