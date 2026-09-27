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
