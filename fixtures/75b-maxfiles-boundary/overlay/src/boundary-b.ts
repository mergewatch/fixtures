// E2E-75b fixture file 2 of 2.

export function titleCase(input: string): string {
  return input.replace(/\b\w/g, (c) => c.toUpperCase());
}
