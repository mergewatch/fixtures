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
