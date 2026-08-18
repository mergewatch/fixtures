export function lookupUser(id: number): Promise<unknown> {
  if (!Number.isInteger(id) || id <= 0) throw new Error('bad id');
  return db.prepare('SELECT * FROM users WHERE id = ?', [id]);
}

declare const db: { prepare(sql: string, p: unknown[]): Promise<unknown> };
