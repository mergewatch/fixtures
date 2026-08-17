// E2E-75a fixture file 1 of 4. The content is deliberately unremarkable —
// this card tests the file-count skip gate, not finding quality. If the skip
// regresses and a review runs anyway, these files are what it will review.

export function toSlug(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
