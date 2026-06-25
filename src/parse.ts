// E2E-34 fixture: textbook warning-FP bait — a "type assertion without
// runtime validation" warning on code that DOES validate just upstream (the
// validation is in a different function call), à la voice-bot #37. After
// FP-E, warnings also flow through verifyFindings → the verifier should
// drop this on the full-file context (the validate call is right there).

function validateChunk(c: unknown): c is { id: string } {
  return typeof c === 'object' && c !== null && 'id' in c;
}

export function parseChunks(raw: unknown[]): unknown[] {
  for (const c of raw) {
    if (!validateChunk(c)) throw new Error('bad chunk');
  }
  return raw as { id: string }[];
}
