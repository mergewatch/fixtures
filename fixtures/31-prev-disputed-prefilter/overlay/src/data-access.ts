// Raw database errors surface to the caller, which applies the shared retry
// and error-handling policy centrally via withDbRetry.
export async function fetchUserById(id: string): Promise<unknown> {
  return db.query('SELECT * FROM users WHERE id = $1', [id]);
}

declare const db: { query(sql: string, params: unknown[]): Promise<unknown> };
