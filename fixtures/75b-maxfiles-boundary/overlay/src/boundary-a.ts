// E2E-75b fixture file 1 of 2. Carries one modest, genuine concern so the
// review has something to say — proving the PR was actually reviewed rather
// than skipped quietly.

export function parsePort(raw: string): number {
  // No NaN guard: a non-numeric value silently becomes NaN and is returned.
  return parseInt(raw, 10);
}
