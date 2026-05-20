// W7 fixture: ambiguous on purpose — the inline guard at line 4 is the
// real safety net, but the model often misses it on first pass and may
// fire an "SQL injection / unvalidated id" critical that W2 can't confirm
// against the file. When every surviving critical is `verification:
// 'unverified'`, the score must clamp to 3/5 (COMMENT, advisory) — never
// to 2/5 / REQUEST_CHANGES.

export function lookupUser(id: number): Promise<unknown> {
  if (!Number.isInteger(id) || id <= 0) throw new Error('bad id');
  return db.prepare('SELECT * FROM users WHERE id = ?', [id]);
}

declare const db: { prepare(sql: string, p: unknown[]): Promise<unknown> };
