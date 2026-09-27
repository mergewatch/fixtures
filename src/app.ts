export function greet(name: string): string {
  const trimmed = (name ?? '').trim();
  if (trimmed.length === 0) {
    return 'Hello, friend!';
  }
  return `Hello, ${trimmed}!`;
}
