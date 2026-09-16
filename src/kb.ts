// The awaited call below is the point of this fixture: `searchCandidates` IS
// awaited, so a "missing await race" CRITICAL is a false positive that W2's
// full-file verification must drop.
//
// mergewatch.ai#570 — these were `declare const` at the BOTTOM of the file.
// `declare` emits no runtime value, so a reviewer reading the file was right
// to flag "references undeclared runtime values" — a second, genuine defect
// with nothing to do with what this fixture tests. It made `critical: 0` fail
// for a reason the fixture never intended to measure. Real initialised values
// remove the confound without weakening the await bait.
const queryEmbedding: number[] = [0.11, 0.42, 0.87];

const kbStore = {
  async searchCandidates(q: number[], k: number): Promise<{ id: string }[]> {
    return q.slice(0, k).map((_, i) => ({ id: `cand-${i}` }));
  },
};

export async function loadKb(): Promise<number> {
  const rows = await kbStore.searchCandidates(queryEmbedding, 8);
  const names = rows.map((r) => r.id);
  return names.length;
}
