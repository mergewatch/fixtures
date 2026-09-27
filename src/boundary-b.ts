export function titleCase(input: string): string {
  return input.replace(/\b\w/g, (c) => c.toUpperCase());
}
