// E2E-77b: the only source file in this PR, and it is excluded. It carries a
// blatant defect so that a clean verdict is meaningful — if the review comes
// back clean, it is because the file was filtered out, not because there was
// nothing to find.

import { Pool } from 'pg';
const pool = new Pool();

// Synthetic credential with a made-up vendor prefix — see the note in
// 76b-both-triggers-off; real-looking prefixes trip GitHub push protection.
const ADMIN_KEY = 'acmecloud_live_key_4d7e1a92c58b3f06e2a9d4c7b1f8e305';

export async function purgeAll(table: string) {
  // SQL injection via an interpolated identifier, plus a hardcoded credential
  // above. Neither may surface: this file is excluded from the agent diff.
  return pool.query(`TRUNCATE TABLE ${table}`, [], { key: ADMIN_KEY } as never);
}
