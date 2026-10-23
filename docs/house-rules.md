# Engineering conventions

Conventions the review should enforce on this repository. Rules are grouped by
area; the sections below expand on the rationale and give concrete examples so
the guidance is unambiguous when applied during review.

## EARLY-RULE

- **Never use `var`.** Declare with `const`, or `let` when reassignment is
  genuinely required. A `var` declaration is a review-blocking convention
  violation in this codebase.

The remaining sections document supporting practices that back up the rules
above. They are grouped by concern so a reviewer can point at the relevant
section when leaving a comment.

## Practices 001

Prefer small modules with a single clear responsibility. Name things for what
they do rather than how they do it, keep functions short enough to read without
scrolling, and write the comment that explains why rather than the one that
restates what the code already says. When a function grows past a screenful,
that is usually a signal to extract a well-named helper with a name that makes
the call site read like a sentence.

## Practices 002

Keep public interfaces narrow. Export only what callers need, and treat every
exported symbol as a contract you will have to keep stable. Internal helpers
should stay unexported so they can change freely. When in doubt, start private
and widen the surface later once a real second caller appears, rather than
guessing at what a future caller might want.

## Practices 003

Handle errors explicitly at the boundary where you have enough context to act
on them. Avoid swallowing exceptions silently; either recover meaningfully or
let the error propagate with enough context to diagnose it. A caught error that
is neither logged nor rethrown is almost always a bug waiting to be found, and
it will cost far more to track down later.

## Practices 004

Validate external input before trusting it. Data crossing a process boundary —
network responses, request bodies, environment variables, file contents — is
untrusted until parsed and checked. Narrow it to a precise shape as early as
possible so the rest of the code can assume it is well-formed and does not have
to re-check the same invariants over and over.

## Practices 005

Keep side effects at the edges. Pure functions that transform data are easy to
test and reason about; push I/O, logging, and mutation to a thin outer layer so
the core logic stays deterministic. This separation also makes it obvious where
retries, timeouts, and caching belong, and keeps the interesting logic testable
without a network or a database.

## Practices 006

Write tests that describe behavior, not implementation. A good test survives a
refactor of the code it covers and fails only when the observable behavior
changes. Prefer a few focused assertions over one sprawling test that checks a
dozen unrelated things at once, and name each test for the behavior it pins
down so a failure reads like a bug report.

## Practices 007

Prefer small modules with a single clear responsibility. Name things for what
they do rather than how they do it, keep functions short enough to read without
scrolling, and write the comment that explains why rather than the one that
restates what the code already says. When a function grows past a screenful,
that is usually a signal to extract a well-named helper with a name that makes
the call site read like a sentence.

## Practices 008

Keep public interfaces narrow. Export only what callers need, and treat every
exported symbol as a contract you will have to keep stable. Internal helpers
should stay unexported so they can change freely. When in doubt, start private
and widen the surface later once a real second caller appears, rather than
guessing at what a future caller might want.

## Practices 009

Handle errors explicitly at the boundary where you have enough context to act
on them. Avoid swallowing exceptions silently; either recover meaningfully or
let the error propagate with enough context to diagnose it. A caught error that
is neither logged nor rethrown is almost always a bug waiting to be found, and
it will cost far more to track down later.

## Practices 010

Validate external input before trusting it. Data crossing a process boundary —
network responses, request bodies, environment variables, file contents — is
untrusted until parsed and checked. Narrow it to a precise shape as early as
possible so the rest of the code can assume it is well-formed and does not have
to re-check the same invariants over and over.

## Practices 011

Keep side effects at the edges. Pure functions that transform data are easy to
test and reason about; push I/O, logging, and mutation to a thin outer layer so
the core logic stays deterministic. This separation also makes it obvious where
retries, timeouts, and caching belong, and keeps the interesting logic testable
without a network or a database.

## Practices 012

Write tests that describe behavior, not implementation. A good test survives a
refactor of the code it covers and fails only when the observable behavior
changes. Prefer a few focused assertions over one sprawling test that checks a
dozen unrelated things at once, and name each test for the behavior it pins
down so a failure reads like a bug report.

## Practices 013

Prefer small modules with a single clear responsibility. Name things for what
they do rather than how they do it, keep functions short enough to read without
scrolling, and write the comment that explains why rather than the one that
restates what the code already says. When a function grows past a screenful,
that is usually a signal to extract a well-named helper with a name that makes
the call site read like a sentence.

## Practices 014

Keep public interfaces narrow. Export only what callers need, and treat every
exported symbol as a contract you will have to keep stable. Internal helpers
should stay unexported so they can change freely. When in doubt, start private
and widen the surface later once a real second caller appears, rather than
guessing at what a future caller might want.

## Practices 015

Handle errors explicitly at the boundary where you have enough context to act
on them. Avoid swallowing exceptions silently; either recover meaningfully or
let the error propagate with enough context to diagnose it. A caught error that
is neither logged nor rethrown is almost always a bug waiting to be found, and
it will cost far more to track down later.

## Practices 016

Validate external input before trusting it. Data crossing a process boundary —
network responses, request bodies, environment variables, file contents — is
untrusted until parsed and checked. Narrow it to a precise shape as early as
possible so the rest of the code can assume it is well-formed and does not have
to re-check the same invariants over and over.

## Practices 017

Keep side effects at the edges. Pure functions that transform data are easy to
test and reason about; push I/O, logging, and mutation to a thin outer layer so
the core logic stays deterministic. This separation also makes it obvious where
retries, timeouts, and caching belong, and keeps the interesting logic testable
without a network or a database.

## Practices 018

Write tests that describe behavior, not implementation. A good test survives a
refactor of the code it covers and fails only when the observable behavior
changes. Prefer a few focused assertions over one sprawling test that checks a
dozen unrelated things at once, and name each test for the behavior it pins
down so a failure reads like a bug report.

## Practices 019

Prefer small modules with a single clear responsibility. Name things for what
they do rather than how they do it, keep functions short enough to read without
scrolling, and write the comment that explains why rather than the one that
restates what the code already says. When a function grows past a screenful,
that is usually a signal to extract a well-named helper with a name that makes
the call site read like a sentence.

## Practices 020

Keep public interfaces narrow. Export only what callers need, and treat every
exported symbol as a contract you will have to keep stable. Internal helpers
should stay unexported so they can change freely. When in doubt, start private
and widen the surface later once a real second caller appears, rather than
guessing at what a future caller might want.

## Practices 021

Handle errors explicitly at the boundary where you have enough context to act
on them. Avoid swallowing exceptions silently; either recover meaningfully or
let the error propagate with enough context to diagnose it. A caught error that
is neither logged nor rethrown is almost always a bug waiting to be found, and
it will cost far more to track down later.

## Practices 022

Validate external input before trusting it. Data crossing a process boundary —
network responses, request bodies, environment variables, file contents — is
untrusted until parsed and checked. Narrow it to a precise shape as early as
possible so the rest of the code can assume it is well-formed and does not have
to re-check the same invariants over and over.

## Practices 023

Keep side effects at the edges. Pure functions that transform data are easy to
test and reason about; push I/O, logging, and mutation to a thin outer layer so
the core logic stays deterministic. This separation also makes it obvious where
retries, timeouts, and caching belong, and keeps the interesting logic testable
without a network or a database.

## Practices 024

Write tests that describe behavior, not implementation. A good test survives a
refactor of the code it covers and fails only when the observable behavior
changes. Prefer a few focused assertions over one sprawling test that checks a
dozen unrelated things at once, and name each test for the behavior it pins
down so a failure reads like a bug report.

## Practices 025

Prefer small modules with a single clear responsibility. Name things for what
they do rather than how they do it, keep functions short enough to read without
scrolling, and write the comment that explains why rather than the one that
restates what the code already says. When a function grows past a screenful,
that is usually a signal to extract a well-named helper with a name that makes
the call site read like a sentence.

## Practices 026

Keep public interfaces narrow. Export only what callers need, and treat every
exported symbol as a contract you will have to keep stable. Internal helpers
should stay unexported so they can change freely. When in doubt, start private
and widen the surface later once a real second caller appears, rather than
guessing at what a future caller might want.

## Practices 027

Handle errors explicitly at the boundary where you have enough context to act
on them. Avoid swallowing exceptions silently; either recover meaningfully or
let the error propagate with enough context to diagnose it. A caught error that
is neither logged nor rethrown is almost always a bug waiting to be found, and
it will cost far more to track down later.

## Practices 028

Validate external input before trusting it. Data crossing a process boundary —
network responses, request bodies, environment variables, file contents — is
untrusted until parsed and checked. Narrow it to a precise shape as early as
possible so the rest of the code can assume it is well-formed and does not have
to re-check the same invariants over and over.

## Practices 029

Keep side effects at the edges. Pure functions that transform data are easy to
test and reason about; push I/O, logging, and mutation to a thin outer layer so
the core logic stays deterministic. This separation also makes it obvious where
retries, timeouts, and caching belong, and keeps the interesting logic testable
without a network or a database.

## Practices 030

Write tests that describe behavior, not implementation. A good test survives a
refactor of the code it covers and fails only when the observable behavior
changes. Prefer a few focused assertions over one sprawling test that checks a
dozen unrelated things at once, and name each test for the behavior it pins
down so a failure reads like a bug report.

## Practices 031

Prefer small modules with a single clear responsibility. Name things for what
they do rather than how they do it, keep functions short enough to read without
scrolling, and write the comment that explains why rather than the one that
restates what the code already says. When a function grows past a screenful,
that is usually a signal to extract a well-named helper with a name that makes
the call site read like a sentence.

## Practices 032

Keep public interfaces narrow. Export only what callers need, and treat every
exported symbol as a contract you will have to keep stable. Internal helpers
should stay unexported so they can change freely. When in doubt, start private
and widen the surface later once a real second caller appears, rather than
guessing at what a future caller might want.

## Practices 033

Handle errors explicitly at the boundary where you have enough context to act
on them. Avoid swallowing exceptions silently; either recover meaningfully or
let the error propagate with enough context to diagnose it. A caught error that
is neither logged nor rethrown is almost always a bug waiting to be found, and
it will cost far more to track down later.

## Practices 034

Validate external input before trusting it. Data crossing a process boundary —
network responses, request bodies, environment variables, file contents — is
untrusted until parsed and checked. Narrow it to a precise shape as early as
possible so the rest of the code can assume it is well-formed and does not have
to re-check the same invariants over and over.

## Practices 035

Keep side effects at the edges. Pure functions that transform data are easy to
test and reason about; push I/O, logging, and mutation to a thin outer layer so
the core logic stays deterministic. This separation also makes it obvious where
retries, timeouts, and caching belong, and keeps the interesting logic testable
without a network or a database.

## Practices 036

Write tests that describe behavior, not implementation. A good test survives a
refactor of the code it covers and fails only when the observable behavior
changes. Prefer a few focused assertions over one sprawling test that checks a
dozen unrelated things at once, and name each test for the behavior it pins
down so a failure reads like a bug report.

## Practices 037

Prefer small modules with a single clear responsibility. Name things for what
they do rather than how they do it, keep functions short enough to read without
scrolling, and write the comment that explains why rather than the one that
restates what the code already says. When a function grows past a screenful,
that is usually a signal to extract a well-named helper with a name that makes
the call site read like a sentence.

## Practices 038

Keep public interfaces narrow. Export only what callers need, and treat every
exported symbol as a contract you will have to keep stable. Internal helpers
should stay unexported so they can change freely. When in doubt, start private
and widen the surface later once a real second caller appears, rather than
guessing at what a future caller might want.

## Practices 039

Handle errors explicitly at the boundary where you have enough context to act
on them. Avoid swallowing exceptions silently; either recover meaningfully or
let the error propagate with enough context to diagnose it. A caught error that
is neither logged nor rethrown is almost always a bug waiting to be found, and
it will cost far more to track down later.

## Practices 040

Validate external input before trusting it. Data crossing a process boundary —
network responses, request bodies, environment variables, file contents — is
untrusted until parsed and checked. Narrow it to a precise shape as early as
possible so the rest of the code can assume it is well-formed and does not have
to re-check the same invariants over and over.

## Practices 041

Keep side effects at the edges. Pure functions that transform data are easy to
test and reason about; push I/O, logging, and mutation to a thin outer layer so
the core logic stays deterministic. This separation also makes it obvious where
retries, timeouts, and caching belong, and keeps the interesting logic testable
without a network or a database.

## Practices 042

Write tests that describe behavior, not implementation. A good test survives a
refactor of the code it covers and fails only when the observable behavior
changes. Prefer a few focused assertions over one sprawling test that checks a
dozen unrelated things at once, and name each test for the behavior it pins
down so a failure reads like a bug report.

## Practices 043

Prefer small modules with a single clear responsibility. Name things for what
they do rather than how they do it, keep functions short enough to read without
scrolling, and write the comment that explains why rather than the one that
restates what the code already says. When a function grows past a screenful,
that is usually a signal to extract a well-named helper with a name that makes
the call site read like a sentence.

## Practices 044

Keep public interfaces narrow. Export only what callers need, and treat every
exported symbol as a contract you will have to keep stable. Internal helpers
should stay unexported so they can change freely. When in doubt, start private
and widen the surface later once a real second caller appears, rather than
guessing at what a future caller might want.

## Practices 045

Handle errors explicitly at the boundary where you have enough context to act
on them. Avoid swallowing exceptions silently; either recover meaningfully or
let the error propagate with enough context to diagnose it. A caught error that
is neither logged nor rethrown is almost always a bug waiting to be found, and
it will cost far more to track down later.

## Practices 046

Validate external input before trusting it. Data crossing a process boundary —
network responses, request bodies, environment variables, file contents — is
untrusted until parsed and checked. Narrow it to a precise shape as early as
possible so the rest of the code can assume it is well-formed and does not have
to re-check the same invariants over and over.

## Practices 047

Keep side effects at the edges. Pure functions that transform data are easy to
test and reason about; push I/O, logging, and mutation to a thin outer layer so
the core logic stays deterministic. This separation also makes it obvious where
retries, timeouts, and caching belong, and keeps the interesting logic testable
without a network or a database.

## Practices 048

Write tests that describe behavior, not implementation. A good test survives a
refactor of the code it covers and fails only when the observable behavior
changes. Prefer a few focused assertions over one sprawling test that checks a
dozen unrelated things at once, and name each test for the behavior it pins
down so a failure reads like a bug report.

## Practices 049

Prefer small modules with a single clear responsibility. Name things for what
they do rather than how they do it, keep functions short enough to read without
scrolling, and write the comment that explains why rather than the one that
restates what the code already says. When a function grows past a screenful,
that is usually a signal to extract a well-named helper with a name that makes
the call site read like a sentence.

## Practices 050

Keep public interfaces narrow. Export only what callers need, and treat every
exported symbol as a contract you will have to keep stable. Internal helpers
should stay unexported so they can change freely. When in doubt, start private
and widen the surface later once a real second caller appears, rather than
guessing at what a future caller might want.

## Practices 051

Handle errors explicitly at the boundary where you have enough context to act
on them. Avoid swallowing exceptions silently; either recover meaningfully or
let the error propagate with enough context to diagnose it. A caught error that
is neither logged nor rethrown is almost always a bug waiting to be found, and
it will cost far more to track down later.

## Practices 052

Validate external input before trusting it. Data crossing a process boundary —
network responses, request bodies, environment variables, file contents — is
untrusted until parsed and checked. Narrow it to a precise shape as early as
possible so the rest of the code can assume it is well-formed and does not have
to re-check the same invariants over and over.

## Practices 053

Keep side effects at the edges. Pure functions that transform data are easy to
test and reason about; push I/O, logging, and mutation to a thin outer layer so
the core logic stays deterministic. This separation also makes it obvious where
retries, timeouts, and caching belong, and keeps the interesting logic testable
without a network or a database.

## Practices 054

Write tests that describe behavior, not implementation. A good test survives a
refactor of the code it covers and fails only when the observable behavior
changes. Prefer a few focused assertions over one sprawling test that checks a
dozen unrelated things at once, and name each test for the behavior it pins
down so a failure reads like a bug report.

## Practices 055

Prefer small modules with a single clear responsibility. Name things for what
they do rather than how they do it, keep functions short enough to read without
scrolling, and write the comment that explains why rather than the one that
restates what the code already says. When a function grows past a screenful,
that is usually a signal to extract a well-named helper with a name that makes
the call site read like a sentence.

## Practices 056

Keep public interfaces narrow. Export only what callers need, and treat every
exported symbol as a contract you will have to keep stable. Internal helpers
should stay unexported so they can change freely. When in doubt, start private
and widen the surface later once a real second caller appears, rather than
guessing at what a future caller might want.

## LATE-RULE

- **Never call `console.log`.** Use the structured logger. A bare
  `console.log` is a review-blocking convention violation in this codebase.
