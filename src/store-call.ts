// E2E-52 fixture: cite a "stale-claim"-shaped finding that the W2 verifier
// often returns 'unverified' for — the cited site goes through an opaque
// store abstraction (`store.query(input)`) whose internal sanitization isn't
// visible from this file. FP-L's rendering filter must then route the
// unverified critical to the "Unverified concerns" sub-section instead of
// the inline / action-items surfaces.
//
// Note: FP-K's abstraction-aware verifier may drop this as valid:false on a
// fresh run if it pattern-matches one of the six known-safe abstractions.
// This fixture is best paired with a mocked verifier path that returns
// no-verdict, which the runbook documents as the cleanest repro.

export async function lookupUser(id: string): Promise<unknown> {
  return store.query(`SELECT * FROM users WHERE id = '${id}'`);
}

declare const store: { query(sql: string): Promise<unknown> };
