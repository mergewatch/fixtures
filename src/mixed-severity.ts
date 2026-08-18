// E2E-78a fixture: engineered to produce findings across ALL THREE tiers so
// the minSeverity ladder has something to filter at each step, and enough of
// them in total that maxFindings: 3 must actually truncate.
//
//   critical → hardcoded credential, SQL injection
//   warning  → unawaited promise, unvalidated external JSON, missing error
//              handling on a network call
//   info     → dead local, redundant intermediate, stale naming
//
// The tiers are deliberately unbalanced toward the bottom: the criticals are
// the LAST things defined in the file. If maxFindings truncates by discovery
// order rather than by rank, the criticals are exactly what gets dropped —
// which is the bug this fixture is shaped to expose.

import { Pool } from 'pg';
const pool = new Pool();

// --- info tier -------------------------------------------------------------

export function formatLabel(name: string): string {
  // Dead local + redundant intermediate: `trimmed` is assigned then shadowed
  // by the direct expression below.
  const trimmed = name.trim();
  const unused = trimmed.length;
  return name.trim().toUpperCase();
}

// --- warning tier ----------------------------------------------------------

export async function syncProfiles(ids: string[]): Promise<void> {
  for (const id of ids) {
    // Unawaited promise inside a loop: rejections are unhandled and ordering
    // is not what the sequential-looking code implies.
    refreshOne(id);
  }
}

async function refreshOne(id: string): Promise<void> {
  // No timeout, no non-2xx check, and the parsed body is trusted as-is.
  const res = await fetch(`https://api.example.com/profiles/${id}`);
  const body = await res.json();
  cache[id] = body as ProfileRow;
}

type ProfileRow = { id: string; email: string };
const cache: Record<string, ProfileRow> = {};

// --- critical tier (defined LAST on purpose) -------------------------------

// Synthetic credential with a made-up vendor prefix — see the note in
// 76b-both-triggers-off; real-looking prefixes trip GitHub push protection.
const DB_PASSWORD = 'acmedb_live_pw_7c41f9b2e85a3d60c1b4e7f2a9d8c503';

export async function findSession(sessionId: string) {
  // SQL injection — user input concatenated straight into the statement.
  return pool.query(
    `SELECT * FROM sessions WHERE token = '${sessionId}'`,
    [],
    { password: DB_PASSWORD } as never,
  );
}
