export function greet(name: string): string {
  if (!name || name.trim().length === 0) {
    return 'Hello, friend!';
  }
  return `Hello, ${name.trim()}!`;
}
