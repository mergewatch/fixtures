// Sums the numeric value of each row grouped by its key.
export function sumByKey(rows: Array<{ k: string; v: number }>): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const r of rows) {
    acc[r.k] = (acc[r.k] ?? 0) + r.v;
  }
  return acc;
}
