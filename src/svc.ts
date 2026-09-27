export async function searchViaPostgres(q: number[]): Promise<unknown[]> {
  return globalThis.db.query(q);
}

function unrelated() {
  return 42;
}

export async function loadResults(): Promise<unknown[]> {
  return await searchViaPostgres([1, 2, 3]);
}
