type ChunkFileEntry = { text: string; embedding: number[]; metadata: unknown };

export async function loadAndIndex(s3Key: string): Promise<void> {
  const raw = await s3.getObject(s3Key);
  const json = JSON.parse(raw.Body.toString());

  const chunks = json as ChunkFileEntry[];

  const values = chunks.map((c, i) => `(${i}, $${i + 1})`).join(', ');
  await db.query(`INSERT INTO chunks VALUES ${values}`);
}

declare const s3: { getObject(key: string): Promise<{ Body: { toString(): string } }> };
declare const db: { query(sql: string): Promise<unknown> };
