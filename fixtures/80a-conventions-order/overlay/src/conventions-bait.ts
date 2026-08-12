// E2E-80a fixture: violates ALL FOUR candidate conventions at once, one
// violation per file. Which rule the review cites tells you which conventions
// file actually resolved — a direct, unambiguous readout of the discovery
// order, with no need to inspect logs.
//
//   `var`         → AGENTS.md               (MARKER-AGENTS,      candidate #2)
//   `==`          → CONVENTIONS.md          (MARKER-CONVENTIONS, candidate #3)
//   `any`         → .mergewatch/conventions.md (MARKER-DOTDIR,   candidate #4)
//   `console.log` → docs/house-rules.md     (MARKER-HOUSE, explicit-only)
//
// With no `conventions:` key set, ONLY the `var` rule may be cited.

/* eslint-disable */

export function describeStatus(input: any): string {
  var label = 'unknown';

  if (input == 'ok') {
    label = 'healthy';
  }

  console.log('resolved status', label);
  return label;
}
