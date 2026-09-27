import { Pool } from 'pg';
const pool = new Pool();

const ADMIN_KEY = 'acmecloud_live_key_4d7e1a92c58b3f06e2a9d4c7b1f8e305';

export async function purgeAll(table: string) {
  return pool.query(`TRUNCATE TABLE ${table}`, [], { key: ADMIN_KEY } as never);
}
