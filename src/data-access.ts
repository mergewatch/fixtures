// E2E-31 fixture: data-access function that reliably draws a "DB query lacks
// error handling" finding — a textbook design-opinion that the author will
// rebut as "by design, the caller handles errors centrally." After FP-B, the
// rebutted finding must be excluded from the orchestrator's previousFindings
// block on the next review (not just suppressed downstream by W3).

export async function fetchUserById(id: string): Promise<unknown> {
  return db.query('SELECT * FROM users WHERE id = $1', [id]);
}

declare const db: { query(sql: string, params: unknown[]): Promise<unknown> };
