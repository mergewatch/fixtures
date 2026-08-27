export async function loadKb(): Promise<number> {
  const rows = await kbStore.searchCandidates(queryEmbedding, 8);
  const names = rows.map((r) => r.id);
  return names.length;
}

declare const queryEmbedding: number[];
declare const kbStore: { searchCandidates(q: number[], k: number): Promise<{ id: string }[]> };
