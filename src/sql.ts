import { Pool } from 'pg';
const pool = new Pool();

export async function findUser(userId: string) {
  // SQL injection — concatenating user input directly into the query string
  const result = await pool.query(`SELECT * FROM users WHERE id = '${userId}'`);
  return result.rows[0];
}
