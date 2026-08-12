// Line 1: the function DEFINITION.
export async function searchViaPostgres(q: number[]): Promise<unknown[]> {
  // Line 3: body.
  return globalThis.db.query(q);
}

// Some unrelated code so the def and the call are not on consecutive lines.
function unrelated() {
  return 42;
}

// Line 12: the call SITE — this is what a finding about
// `searchViaPostgres` should anchor at.
export async function loadResults(): Promise<unknown[]> {
  return await searchViaPostgres([1, 2, 3]);
}
