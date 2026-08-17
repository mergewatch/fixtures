// E2E-75a fixture file 3 of 4.

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}
