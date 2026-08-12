// E2E-68 fixture: bait for an org-level custom agent named `no-todo` whose
// prompt is "Flag any new TODO comment". Lives under src/** so the path-glob
// targeting step (`src/**`) matches; the docs-only counter-case is a separate
// manual step in the fixture README.
//
// Nothing here is a genuine defect on its own — the finding must come from the
// org agent, not from the stock bug/security agents. That is the point: it
// isolates org-agent execution from the normal pipeline.

export type RetryPolicy = { attempts: number; backoffMs: number };

// TODO: make the retry policy configurable per caller before GA
const DEFAULT_POLICY: RetryPolicy = { attempts: 3, backoffMs: 250 };

export function resolvePolicy(override?: Partial<RetryPolicy>): RetryPolicy {
  // TODO: validate that attempts is positive once the config schema lands
  return { ...DEFAULT_POLICY, ...override };
}
