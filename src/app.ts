export function greet(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error('name must be non-empty');
  }
  return `Hello, ${trimmed}!`;
}

export function farewell(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return 'Goodbye, friend!';
  }
  return `Goodbye, ${trimmed}!`;
}
