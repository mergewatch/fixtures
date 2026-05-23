// E2E-49 fixture: an unrelated file that has NO error-handling code. Step 2
// adds a tiny change here (after fixing src/worker.ts's real findings) to
// verify FP-H's anti-anchoring — round-2 must not invent error-handling
// findings on code that has no async/error surface.

export function formatLabel(name: string, count: number): string {
  return `${name} [${count}]`;
}
