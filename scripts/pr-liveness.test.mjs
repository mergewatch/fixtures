import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkStateFrom, isLive, tornDown, tornDownReport, UNKNOWN } from './pr-liveness.mjs';

const CHECK = 'MergeWatch Review (dev)';

// --- checkStateFrom ---------------------------------------------------------

test('no check run of that name is absent, not queued', () => {
  // The distinction carries the diagnosis: absent means the webhook was never
  // handled, queued means it was accepted and has not started.
  assert.equal(checkStateFrom([], CHECK), 'absent');
  assert.equal(checkStateFrom([{ name: 'Build & Test', status: 'completed' }], CHECK), 'absent');
});

test('a missing or null rollup is absent rather than a crash', () => {
  // `gh` omits the field entirely on some PRs; a throw here would abort the
  // whole wait on one odd payload.
  assert.equal(checkStateFrom(undefined, CHECK), 'absent');
  assert.equal(checkStateFrom(null, CHECK), 'absent');
});

test('null entries in the rollup are skipped', () => {
  assert.equal(checkStateFrom([null, { name: CHECK, status: 'completed' }], CHECK), 'completed');
});

test('reads the LAST run of the name, not the first', () => {
  // A re-review adds a second check run. Grading against the stale first one
  // would report a finished review as still queued forever.
  assert.equal(
    checkStateFrom(
      [{ name: CHECK, status: 'completed' }, { name: CHECK, status: 'in_progress' }],
      CHECK,
    ),
    'in_progress',
  );
});

test('an empty status is treated as queued', () => {
  assert.equal(checkStateFrom([{ name: CHECK }], CHECK), 'queued');
  assert.equal(checkStateFrom([{ name: CHECK, status: '' }], CHECK), 'queued');
});

test('status matching is case-insensitive', () => {
  assert.equal(checkStateFrom([{ name: CHECK, status: 'COMPLETED' }], CHECK), 'completed');
});

test('the check name must match exactly — stages must not bleed into each other', () => {
  // "MergeWatch Review" and "MergeWatch Review (dev)" are different checks from
  // different stages. A prefix match would grade a dev run against prod's
  // verdict.
  assert.equal(checkStateFrom([{ name: 'MergeWatch Review', status: 'completed' }], CHECK), 'absent');
});

// --- isLive -----------------------------------------------------------------

test('OPEN is live', () => {
  assert.equal(isLive('OPEN'), true);
});

test('CLOSED and MERGED are gone', () => {
  assert.equal(isLive('CLOSED'), false);
  assert.equal(isLive('MERGED'), false);
});

test('state is matched case-insensitively', () => {
  assert.equal(isLive('closed'), false);
  assert.equal(isLive('open'), true);
});

test('anything unrecognised is UNKNOWN, never gone', () => {
  // Aborting a run on a payload we did not understand would replace a slow
  // honest failure with a fast wrong one.
  assert.equal(isLive(undefined), UNKNOWN);
  assert.equal(isLive(null), UNKNOWN);
  assert.equal(isLive(''), UNKNOWN);
  assert.equal(isLive('DRAFT'), UNKNOWN);
  assert.equal(isLive(42), UNKNOWN);
  assert.equal(isLive({ state: 'CLOSED' }), UNKNOWN);
});

test('UNKNOWN is null, so `live === false` is the only gone-test', () => {
  // The loop tests `e.live === false`. If UNKNOWN were falsy-but-not-false
  // this would still read as gone, and an API blip would abort every run.
  assert.equal(UNKNOWN, null);
  assert.notEqual(UNKNOWN, false);
});

// --- tornDown ---------------------------------------------------------------

test('reports only the entries that are definitively gone', () => {
  const gone = tornDown([
    { fixture: 'a', pr: 1, live: true },
    { fixture: 'b', pr: 2, live: false },
    { fixture: 'c', pr: 3, live: UNKNOWN },
  ]);
  assert.deepEqual(gone.map((g) => g.fixture), ['b']);
});

test('an all-unknown poll reports nothing gone', () => {
  // Every PR unreachable is what a network outage looks like. It must keep
  // waiting, not declare a teardown.
  assert.deepEqual(tornDown([{ live: UNKNOWN }, { live: UNKNOWN }]), []);
});

test('empty, missing and sparse inputs do not throw', () => {
  assert.deepEqual(tornDown([]), []);
  assert.deepEqual(tornDown(undefined), []);
  assert.deepEqual(tornDown([null, undefined]), []);
});

// --- tornDownReport ---------------------------------------------------------

test('names the cause, the fixtures, and that the run proved nothing', () => {
  const text = tornDownReport([{ fixture: '01-clean-pr', pr: 42, state: 'absent' }]).join('\n');
  assert.match(text, /^::error::/m);                 // fails the CI step visibly
  assert.match(text, /01-clean-pr #42/);             // which fixture
  assert.match(text, /reset-env\.sh/);               // what did it
  assert.match(text, /proved nothing about the product/);  // how to read the result
  assert.match(text, /e2e-fixtures/);                // where the CI fix lives
});

test('lists every torn-down fixture, not just the first', () => {
  const lines = tornDownReport([
    { fixture: 'a', pr: 1, state: 'absent' },
    { fixture: 'b', pr: 2, state: 'queued' },
  ]);
  assert.equal(lines.filter((l) => l.startsWith('  ✗')).length, 2);
  assert.match(lines[0], /^::error::2 fixture PR\(s\)/);
});
