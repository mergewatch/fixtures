// E2E-77a excluded file — matches `**/*.generated.ts`. It carries a defect
// just as obvious as the one in handler.ts, on purpose: if excludePatterns is
// working, the review must never mention this file, this function, or this
// line. Any reference to it — a finding, an inline comment, or a node in the
// Mermaid diagram — is a filter regression.

import { Pool } from 'pg';
const pool = new Pool();

export async function deleteAuditRow(rowId: string) {
  // SQL injection — identical shape to the one in handler.ts.
  return pool.query(`DELETE FROM audit_log WHERE id = '${rowId}'`);
}
