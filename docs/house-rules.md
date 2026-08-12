# Engineering conventions — oversized on purpose (E2E-80b)

This file is deliberately larger than `CONVENTIONS_MAX_BYTES` (16 KB) so the
truncation path is exercised. It carries exactly two enforceable rules: one
near the top, inside the cap, and one at the very bottom, past it.

## EARLY-RULE — inside the 16 KB cap, MUST reach the agents

- **Never use `var`.** Declare with `const`, or `let` when reassignment is
  genuinely required. A `var` declaration is a review-blocking convention
  violation in this codebase.

Everything that follows, up to the final section, is filler whose only job is
to push the byte count past the cap. Section numbering makes it easy to see
roughly where the truncation marker landed.

## Filler section 001

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 002

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 003

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 004

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 005

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 006

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 007

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 008

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 009

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 010

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 011

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 012

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 013

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 014

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 015

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 016

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 017

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 018

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 019

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 020

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 021

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 022

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 023

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 024

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 025

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 026

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 027

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 028

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 029

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 030

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 031

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 032

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 033

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 034

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 035

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 036

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 037

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 038

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 039

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 040

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 041

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 042

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 043

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 044

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 045

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 046

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 047

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## Filler section 048

Guidance in this section is intentionally inert — it states no rule the
fixture asserts on. It exists to consume bytes so that the final rule at the
end of this file falls beyond the 16 KB truncation boundary. Prefer small
modules, name things for what they do rather than how they do it, keep
functions short enough to read without scrolling, and write the comment that
explains why rather than the one that restates what.

## LATE-RULE — past the 16 KB cap, must NOT reach the agents

- **Never call `console.log`.** Use the structured logger. A bare
  `console.log` is a review-blocking convention violation in this codebase.

If a review cites this rule, the 16 KB cap is not being enforced.
