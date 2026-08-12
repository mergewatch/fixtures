// E2E-77a control file — NOT excluded. The planted defect here MUST be
// reported; it proves the review ran and the agents saw a diff.
//
// (The runbook card names src/utils.ts for this role. This fixture uses a new
// file instead so the baseline's co-located src/utils.test.ts coverage isn't
// disturbed — an added public function in utils.ts would draw unrelated
// test-coverage findings and muddy the excludePatterns signal.)

import { Pool } from 'pg';
const pool = new Pool();

export async function deleteSession(sessionId: string) {
  // SQL injection — user input concatenated straight into the statement.
  return pool.query(`DELETE FROM sessions WHERE id = '${sessionId}'`);
}
