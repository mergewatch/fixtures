export function getCached<T>(key: string): T | null {
  // TODO: this currently returns stale data after invalidation — fix me.
  return cache.get(key) as T | null ?? null;
}

declare const cache: Map<string, unknown>;
