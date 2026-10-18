export async function searchCandidates(q: number[], k: number): Promise<unknown[]> {
  return globalThis.db.searchEmbeddings(q, k);
}

declare global {
  // eslint-disable-next-line no-var
  var db: { searchEmbeddings(q: number[], k: number): Promise<unknown[]> };
}

export {};
