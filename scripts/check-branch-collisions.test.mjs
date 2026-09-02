import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * check-branch-collisions.sh, against a stubbed `gh`.
 *
 * The bug it prevents cost about $13 and 45 minutes: fixture 16-agent-authored
 * uses `BRANCH=claude/fix-greet-bug`, reset-env only closes `fixture/*`, so its
 * PR survived teardown and the next run could not open a second PR for the same
 * branch. The fixture failed AFTER everything ahead of it had already spent
 * review budget.
 */
const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'check-branch-collisions.sh');
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Run the check with `gh pr list` returning `branches`. */
function run(branches, fixtures, { ghFails = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'collide-'));
  const shim = join(dir, 'gh');
  writeFileSync(shim, ghFails
    ? '#!/bin/sh\nexit 1\n'
    : `#!/bin/sh\ncat <<'EOF'\n${branches.join('\n')}\nEOF\n`);
  chmodSync(shim, 0o755);

  return spawnSync('bash', [SCRIPT, ...fixtures], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
  });
}

test('blocks when a fixture already has an open PR on its branch', () => {
  // The real case. 16-agent-authored declares BRANCH=claude/fix-greet-bug.
  const r = run(['claude/fix-greet-bug'], ['16-agent-authored']);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /16-agent-authored -> claude\/fix-greet-bug/);
  assert.match(r.stderr, /gh pr close/);
  // Names the underlying cause, so the reader does not just close and move on.
  assert.match(r.stderr, /named fixture\/\*, which is all reset-env/);
});

test('passes when no selected fixture collides', () => {
  const r = run(['fixture/99-unrelated', 'some/human-branch'], ['16-agent-authored']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr.trim(), '');
});

test('an unrelated open PR does not block anything', () => {
  // reset-env deliberately leaves non-fixture branches alone (fixtures#763).
  // A human's PR must never fail this check.
  const r = run(['someone/real-work'], ['01-clean-pr', '16-agent-authored']);
  assert.equal(r.status, 0, r.stderr);
});

test('matches the branch exactly, not as a prefix', () => {
  // `claude/fix-greet-bug-2` is a different branch and must not trip it.
  const r = run(['claude/fix-greet-bug-2'], ['16-agent-authored']);
  assert.equal(r.status, 0, r.stderr);
});

test('reports every collision, not just the first', () => {
  const r = run(['claude/fix-greet-bug', 'fixture/01-clean-pr'], ['16-agent-authored', '01-clean-pr']);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /2 fixture\(s\) already have an open PR/);
});

test('a gh failure warns and lets the run proceed', () => {
  // Trading a real failure mode for a spurious one would be worse than the bug.
  const r = run([], ['16-agent-authored'], { ghFails: true });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /skipping the branch-collision preflight/);
});

test('a fixture with no BRANCH is ignored', () => {
  const r = run(['claude/fix-greet-bug'], ['zz-does-not-exist']);
  assert.equal(r.status, 0, r.stderr);
});

test('run-suite calls it before applying anything', () => {
  // The value is entirely in running first. Called after the loop starts, it
  // reports a problem the run has already paid for.
  const src = spawnSync('cat', [join(REPO_ROOT, 'scripts/run-suite.sh')], { encoding: 'utf8' }).stdout;
  const check = src.indexOf('check-branch-collisions.sh');
  const apply = src.indexOf('if "$APPLY" "$name"; then');
  assert.ok(check !== -1, 'run-suite no longer calls the preflight');
  assert.ok(check < apply, 'the preflight must run before the first apply');
});
