// E2E-38 fixture: a finding the orchestrator's confidence often wavers on
// across runs — a "consider memoization" or "this synchronous loop could be
// expensive" warning on a simple aggregator. The exact framing varies; the
// signal is whether the SAME finding from review #1 silently disappears on
// review #2 with the cited code unchanged.

export function sumByKey(rows: Array<{ k: string; v: number }>): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const r of rows) {
    acc[r.k] = (acc[r.k] ?? 0) + r.v;
  }
  return acc;
}
