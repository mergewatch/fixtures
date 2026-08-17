// E2E-80b fixture: violates BOTH rules in the oversized conventions file —
// the one near the top (inside the 16 KB cap) and the one near the bottom
// (past it). The pair is the readout:
//
//   `var`         → EARLY-RULE, inside the cap  → MUST be cited
//   `console.log` → LATE-RULE, past the cap     → must NOT be cited
//
// Citing both means the cap isn't applied. Citing neither means the
// conventions file didn't resolve at all — check 80a first in that case.

/* eslint-disable */

export function reportHealth(status: string): string {
  var normalized = status.trim().toLowerCase();
  console.log('health check', normalized);
  return normalized;
}
