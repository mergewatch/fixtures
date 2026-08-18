// E2E-29 fixture: designed to draw fragmented findings from multiple agents
// on overlapping concerns about validating the parsed S3 chunk file.
// Bug / security / style / error-handling agents each have a distinct angle on
// the same root cause ("validate the parsed chunk file structure"), so the
// orchestrator output is expected to surface 2-3 findings in a tight line
// window. clusterFindings must collapse them into ONE row in "Requires your
// attention" with a "Related concerns" list of the absorbed siblings.

type ChunkFileEntry = { text: string; embedding: number[]; metadata: unknown };

export async function loadAndIndex(s3Key: string): Promise<void> {
  // 1) Untrusted JSON — the json-parse / data-validation angle.
  const raw = await s3.getObject(s3Key);
  const json = JSON.parse(raw.Body.toString());

  // 2) Type assertion without runtime validation — the type-safety angle,
  //    same blob.
  const chunks = json as ChunkFileEntry[];

  // 3) Dynamic VALUES construction — the security angle, near the same code.
  const values = chunks.map((c, i) => `(${i}, $${i + 1})`).join(', ');
  await db.query(`INSERT INTO chunks VALUES ${values}`);
}

declare const s3: { getObject(key: string): Promise<{ Body: { toString(): string } }> };
declare const db: { query(sql: string): Promise<unknown> };
