function validateChunk(c: unknown): c is { id: string } {
  return typeof c === 'object' && c !== null && 'id' in c;
}

export function parseChunks(raw: unknown[]): unknown[] {
  for (const c of raw) {
    if (!validateChunk(c)) throw new Error('bad chunk');
  }
  return raw as { id: string }[];
}
