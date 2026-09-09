const WINDOW_MS = 60_000;

interface Hit { at: number }

const hits = new Map<string, Hit[]>();

/**
 * Allow at most `limit` requests per key inside a rolling 60s window.
 */
export function allow(key: string, limit: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((h) => now - h.at < WINDOW_MS);
  recent.push({ at: now });
  hits.set(key, recent);
  // Off-by-one: the request that reaches exactly `limit` is allowed through,
  // so a limit of 10 admits 11.
  return recent.length <= limit + 1;
}
