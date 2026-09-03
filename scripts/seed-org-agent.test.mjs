import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * seed-org-agent.sh, against a stubbed `aws` and `gh`.
 *
 * The bug this locks down: the installation-id scan ran as
 * `… 2>/dev/null || true`, so a credentials failure and an absent row both
 * produced an empty string and printed the same sentence — "Could not
 * auto-discover the installation id".
 *
 * 68-org-custom-agents skipped on every deploy gate for weeks with that
 * message, which reads as a missing row. The real cause is that the gate job
 * has no AWS credentials at all, so the scan failed on authentication every
 * single run. Nothing distinguished "I cannot look" from "it is not there".
 *
 * The exit codes carry the difference because apply-fixture branches on them:
 * 3 means the prerequisite is genuinely absent and the fixture should be
 * skipped; anything else is a real error worth surfacing.
 */
const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'seed-org-agent.sh');
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @param awsBehaviour 'denied' | 'empty' | 'found'
 */
function run(awsBehaviour, args = ['--verify']) {
  const dir = mkdtempSync(join(tmpdir(), 'seed-agent-'));

  const aws = {
    // Credentials/permissions failure: non-zero exit, message on stderr.
    denied: '#!/bin/sh\necho "aws: [ERROR]: Unable to locate credentials" >&2\nexit 255\n',
    // Reachable, but no installation matches this repo.
    empty: '#!/bin/sh\necho "None"\n',
    // Reachable, row present, and the agent is enabled.
    found: `#!/bin/sh
case "$*" in
  *scan*) echo "142368585" ;;
  *get-item*) echo '{"Item":{"agents":{"L":[{"M":{"name":{"S":"no-todo"},"enabled":{"BOOL":true}}}]}}}' ;;
esac
`,
  }[awsBehaviour];

  writeFileSync(join(dir, 'aws'), aws);
  chmodSync(join(dir, 'aws'), 0o755);
  writeFileSync(join(dir, 'gh'), '#!/bin/sh\necho "mergewatch/fixtures"\n');
  chmodSync(join(dir, 'gh'), 0o755);

  return spawnSync('bash', [SCRIPT, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, INSTALLATION_ID: '' },
  });
}

test('an access failure exits 1 and says so — not "missing row"', () => {
  const r = run('denied');
  assert.equal(r.status, 1, r.stderr);
  assert.match(r.stderr, /ACCESS problem, not a missing row/);
  // The underlying AWS error must reach the reader; swallowing it is what made
  // this take weeks to diagnose.
  assert.match(r.stderr, /Unable to locate credentials/);
  // And it must NOT claim the row is absent.
  assert.doesNotMatch(r.stderr, /genuinely absent/);
});

test('an access failure names CI as a place this can never succeed', () => {
  // The gate job has no AWS credentials, so the prerequisite is unsatisfiable
  // there by construction. Saying so turns a recurring mystery into a fact.
  assert.match(run('denied').stderr, /E2E gate job has no AWS credentials/);
});

test('a genuinely absent row exits 3, which is what marks a fixture skipped', () => {
  const r = run('empty');
  assert.equal(r.status, 3, r.stderr);
  assert.match(r.stderr, /genuinely absent/);
  assert.doesNotMatch(r.stderr, /ACCESS problem/);
});

test('the two failures do not share an exit code', () => {
  // apply-fixture branches on this: 3 skips the fixture, anything else is an
  // error. One code for both would make a broken environment look like an
  // unmet precondition — which is exactly what happened.
  assert.notEqual(run('denied').status, run('empty').status);
});

test('a resolvable installation with an enabled agent verifies clean', () => {
  const r = run('found');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /no-todo agent/);
});
