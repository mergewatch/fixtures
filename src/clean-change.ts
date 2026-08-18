// E2E-78b fixture: a genuinely clean, well-formed change — validated input,
// explicit error handling, no unhandled promise, no injection surface. It
// must produce a CLEAN review, because the behavior under test only applies
// when there are no findings to report.
//
// Modelled on the E2E-01 clean-PR shape. If this draws findings, the fixture
// is not exercising postSummaryOnClean at all — fix the file before reading
// anything into the result.

export type Money = { cents: number; currency: 'USD' | 'EUR' };

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add ${a.currency} to ${b.currency}`);
  }
  return { cents: a.cents + b.cents, currency: a.currency };
}

export function formatMoney(value: Money): string {
  const symbol = value.currency === 'USD' ? '$' : '€';
  const whole = Math.trunc(value.cents / 100);
  const fraction = Math.abs(value.cents % 100).toString().padStart(2, '0');
  return `${symbol}${whole}.${fraction}`;
}
