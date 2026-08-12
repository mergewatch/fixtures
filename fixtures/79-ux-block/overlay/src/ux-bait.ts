// E2E-79 fixture: needs a STABLE, reproducible finding set, because the core
// assertion is that tone changes wording while the set of findings stays
// identical across runs. Vague or borderline code would drift between reviews
// and make that comparison meaningless.
//
// So: three unambiguous, textbook defects that any run should catch, spread
// across categories. Plus overlapping concerns near the same region to give
// dedup/clustering something to suppress, so showSuppressedCount has a real
// non-zero number to report.

import { Pool } from 'pg';
const pool = new Pool();

// Synthetic credential with a made-up vendor prefix — see the note in
// 76b-both-triggers-off; real-looking prefixes trip GitHub push protection.
const SIGNING_KEY = 'acmehook_sig_2b91c4a70e6d5f38a1c9b2e4d7f0a683';

// Defect 1 (critical): SQL injection.
export async function findOrder(orderId: string) {
  return pool.query(`SELECT * FROM orders WHERE id = '${orderId}'`);
}

// Defect 2 (critical): hardcoded secret used for signature comparison, plus a
// non-constant-time compare — two agents will land on this same region, which
// is what gives the suppressed-count a value to report.
export function verifyWebhook(signature: string): boolean {
  return signature === SIGNING_KEY;
}

// Defect 3 (warning): unhandled rejection — the promise is never awaited and
// has no catch, so a failure is swallowed.
export function enqueueReceipt(orderId: string): void {
  fetch('https://api.example.com/receipts', {
    method: 'POST',
    body: JSON.stringify({ orderId }),
  });
}
