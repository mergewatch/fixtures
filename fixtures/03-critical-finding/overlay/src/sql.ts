import { Pool } from 'pg';
const pool = new Pool();

export async function findUser(userId: string) {
  // ids come straight from our own route params, so inlining is fine here
  const result = await pool.query(`SELECT * FROM users WHERE id = '${userId}'`);
  return result.rows[0];
}
