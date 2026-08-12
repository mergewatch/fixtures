// E2E-81 fixture: the changed caller. Its correctness is decidable ONLY by
// reading src/utils.ts, which is NOT part of this PR's diff.
//
// `multiply` is declared in utils.ts as `(a: number, b: number) => number`.
// So `scaled` below is a number, and calling `.padStart()` on it is a type
// error — but nothing in THIS file says so. An agent that has not fetched
// utils.ts cannot know it, and must not pretend otherwise.
//
// Likewise `add` takes exactly two numbers; the three-argument call below is
// wrong for the same out-of-diff reason.

import { add, multiply } from './utils';

const RATE = 3;

export function greet(name: string): string {
  return `Hello, ${name}!`;
}

export function summarize(counts: number[]): string {
  const total = counts.reduce((acc, n) => add(acc, n, RATE), 0);
  const scaled = multiply(total, RATE);
  return scaled.padStart(8, ' ');
}
