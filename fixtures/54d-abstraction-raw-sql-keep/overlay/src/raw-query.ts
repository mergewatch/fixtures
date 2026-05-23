// E2E-54d fixture: REGRESSION GUARD for FP-K. Raw string-concat SQL — no
// abstraction in sight (no Drizzle, no Prisma, no prepared statements, no
// ExpressionAttributeValues). The verifier MUST keep the "SQL injection"
// critical here. The fail-safe rule biases toward VALID when no abstraction
// is present on the cited path.

export async function findUser(id: string): Promise<unknown> {
  return db.query(`SELECT * FROM users WHERE id = '${id}'`);
}

declare const db: { query(sql: string): Promise<unknown> };
