import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * End-to-end over `await-reviews.mjs` itself, with a fake `gh` on PATH.
 *
 * pr-liveness.test.mjs covers the decision. This covers the WIRING, which is
 * where the bugs in this area actually live: the script asks `gh` for a field
 * by name and compares the value against a literal, and either half can be
 * spelled wrong without any pure test noticing. `state` not being a real
 * `--json` field, or GitHub returning `closed` where we compare `CLOSED`,
 * would leave every unit test green and the guard permanently dead.
 *
 * The `gh` shim answers every call identically, which is enough: the script
 * makes one `gh pr view` per target per poll and nothing else.
 */
const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'await-reviews.mjs');
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Run await-reviews with a stubbed `gh` that always returns `payload`. */
function runWith(payload, { prs = [{ fixture: 'zz-liveness-probe', pr: 42 }] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'await-reviews-'));

  const shim = join(dir, 'gh');
  writeFileSync(shim, `#!/bin/sh\ncat <<'JSON'\n${JSON.stringify(payload)}\nJSON\n`);
  chmodSync(shim, 0o755);

  const manifest = join(dir, 'manifest.json');
  // `repo` set explicitly so the script never falls back to `gh repo view`.
  writeFileSync(manifest, JSON.stringify({ repo: 'mergewatch/fixtures', fixtures: prs }));

  return spawnSync(
    process.execPath,
    [SCRIPT, '--manifest', manifest, '--stage', 'dev', '--timeout', '4', '--interval', '1'],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
    },
  );
}

const completed = { name: 'MergeWatch Review (dev)', status: 'completed' };

test('a closed PR aborts immediately with the teardown explanation', () => {
  // The literal `CLOSED` is what the real API returns for a fixture PR that
  // reset-env.sh closed — verified against mergewatch/fixtures#1095.
  const r = runWith({ state: 'CLOSED', statusCheckRollup: [] });
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /were closed while this run was waiting/);
  assert.match(r.stderr, /zz-liveness-probe #42/);
  // Not the timeout path: that is the wrong diagnosis and the wrong exit code.
  assert.doesNotMatch(r.stderr, /Timed out/);
});

test('a merged PR is treated the same way', () => {
  const r = runWith({ state: 'MERGED', statusCheckRollup: [] });
  assert.equal(r.status, 2, r.stderr);
});

test('it aborts on the FIRST poll, not after burning the timeout', () => {
  // The whole point is not waiting out 900s to reach a wrong conclusion. With
  // a 4s timeout and a 1s interval, a timeout path would take ~4s.
  const started = Date.now();
  const r = runWith({ state: 'CLOSED', statusCheckRollup: [] });
  assert.equal(r.status, 2, r.stderr);
  assert.ok(Date.now() - started < 3000, 'should not have polled to the deadline');
});

test('an open PR with a completed check still passes', () => {
  // Back-compat: adding the liveness field must not change the happy path.
  const r = runWith({ state: 'OPEN', statusCheckRollup: [completed] });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /All 1 review\(s\) completed/);
});

test('an open PR with no check run times out and blames the webhook, not teardown', () => {
  const r = runWith({ state: 'OPEN', statusCheckRollup: [] });
  assert.equal(r.status, 1, r.stderr);
  assert.match(r.stderr, /Timed out/);
  assert.match(r.stderr, /absent = no check run at all/);
});

test('an unreadable state keeps waiting rather than declaring teardown', () => {
  // A `gh` that returns something we do not recognise must not abort the run.
  const r = runWith({ statusCheckRollup: [] });
  assert.equal(r.status, 1, r.stderr);
  assert.match(r.stderr, /Timed out/);
});

test('fixtures with no PR are not waited on at all', () => {
  const r = runWith({ state: 'CLOSED', statusCheckRollup: [] }, {
    prs: [{ fixture: 'zz-manual-only', pr: null }],
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /No fixture PRs to wait for/);
});
