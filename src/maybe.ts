export function lookupByPattern(
  rows: Array<{ id: number; name: string }>,
  q: string,
): unknown {
  return rows.find((r) => new RegExp(q).test(r.name));
}
