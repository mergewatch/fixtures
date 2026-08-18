import { Pool } from 'pg';
const pool = new Pool();

export async function deleteSession(sessionId: string) {
  return pool.query(`DELETE FROM sessions WHERE id = '${sessionId}'`);
}
