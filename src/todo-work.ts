export type RetryPolicy = { attempts: number; backoffMs: number };

// TODO: make the retry policy configurable per caller before GA
const DEFAULT_POLICY: RetryPolicy = { attempts: 3, backoffMs: 250 };

export function resolvePolicy(override?: Partial<RetryPolicy>): RetryPolicy {
  // TODO: validate that attempts is positive once the config schema lands
  return { ...DEFAULT_POLICY, ...override };
}
