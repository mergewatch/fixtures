// E2E-30 fixture: designed to draw a low-confidence finding. The model often
// says "consider escaping `q` to avoid pattern injection" with confidence ~60
// because the threat model is ambiguous (RegExp(q) can be misused, but the
// caller may already trust the source). FP-A drops any finding with
// confidence < 75 deterministically post-orchestrator.
export function lookupByPattern(
  rows: Array<{ id: number; name: string }>,
  q: string,
): unknown {
  return rows.find((r) => new RegExp(q).test(r.name));
}
