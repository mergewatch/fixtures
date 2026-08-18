const memCache = new Map<string, string>();

export function savePref(key: string, value: string): void {
  memCache.set(`pref:${key}`, value);
}
