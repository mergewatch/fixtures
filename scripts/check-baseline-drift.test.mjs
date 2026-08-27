import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * check-baseline-drift.sh, against throwaway git repos.
 *
 * The script's whole value is that it fires BEFORE anything is pushed, so
 * there is no way to test it by running a suite — by then the thing it
 * prevents has already happened. Building the repo states directly is the only
 * honest way to prove each branch, including the ones that must NOT fire: a
 * preflight that blocks legitimate runs gets disabled, and then it protects
 * nothing.
 */
const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'check-baseline-drift.sh');

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

function write(dir, relPath, body) {
  mkdirSync(join(dir, dirname(relPath)), { recursive: true });
  writeFileSync(join(dir, relPath), body);
}

/**
 * A repo with a commit tagged `e2e-baseline`, then a second commit that
 * `origin/main` points at. `changes` is applied in that second commit.
 *
 * `localMainAtBaseline` reproduces the state reset-env.sh leaves behind: local
 * main hard-reset to the tag. That is the normal state of a machine that just
 * tore a run down, so the check has to survive it.
 */
function repoWith(changes, { tag = true, origin = true, localMainAtBaseline = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'drift-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 't@example.com');
  git(dir, 'config', 'user.name', 'test');

  write(dir, '.github/workflows/suite.yml', 'name: suite\n');
  write(dir, 'src/app.ts', 'export const x = 1;\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'baseline');
  const baseline = git(dir, 'rev-parse', 'HEAD');
  if (tag) git(dir, 'tag', 'e2e-baseline');

  if (Object.keys(changes).length) {
    for (const [p, body] of Object.entries(changes)) write(dir, p, body);
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'main moves on');
  }
  // No real remote: the script's `git fetch` is best-effort and must tolerate
  // failing. The remote-tracking ref is what it actually reads.
  if (origin) git(dir, 'update-ref', 'refs/remotes/origin/main', git(dir, 'rev-parse', 'HEAD'));
  if (localMainAtBaseline) git(dir, 'reset', '-q', '--hard', baseline);

  return dir;
}

const run = (dir, env = {}) =>
  spawnSync('bash', [SCRIPT], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } });

// --- must fire --------------------------------------------------------------

test('workflow drift aborts with exit 2, naming the file and the fix', () => {
  const r = run(repoWith({ '.github/workflows/suite.yml': 'name: suite\non: push\n' }));
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /\.github\/workflows\/suite\.yml/);
  assert.match(r.stderr, /git tag -f e2e-baseline main/);
  // The safety precondition must travel with the command that needs it.
  assert.match(r.stderr, /must be EMPTY/);
});

test('a workflow file added only on main counts as drift', () => {
  // This is the shape #506 created: main gained ci.yml, the tag did not.
  const r = run(repoWith({ '.github/workflows/ci.yml': 'name: ci\n' }));
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /ci\.yml/);
});

test('detects drift even when local main sits at the baseline', () => {
  // reset-env.sh hard-resets local main to the tag, so `main` and
  // `e2e-baseline` are the same commit on any machine that just tore a run
  // down. Comparing against `main` instead of `origin/main` would pass here —
  // silently, and precisely when the check is most needed.
  const r = run(
    repoWith({ '.github/workflows/suite.yml': 'name: changed\n' }, { localMainAtBaseline: true }),
  );
  assert.equal(r.status, 2, r.stderr);
});

// --- must NOT fire ----------------------------------------------------------

test('an identical baseline passes', () => {
  const r = run(repoWith({}));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr.trim(), '');
});

test('changes outside .github/workflows are not drift', () => {
  // Fixture overlays change src/ on every single run. Treating that as drift
  // would block every suite immediately.
  const r = run(repoWith({ 'src/app.ts': 'export const x = 2;\n', 'README.md': 'hi\n' }));
  assert.equal(r.status, 0, r.stderr);
});

test('no e2e-baseline tag is not this check\'s problem', () => {
  // A repo that has not been bootstrapped. run-suite.sh's fixture-existence
  // preflight reports that far better than this can.
  const r = run(repoWith({}, { tag: false }));
  assert.equal(r.status, 0, r.stderr);
});

test('no origin/main skips, and says so rather than passing silently', () => {
  const r = run(
    repoWith({ '.github/workflows/suite.yml': 'name: changed\n' }, { origin: false }),
  );
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /skipping the baseline drift check/);
});

// --- the escape hatch -------------------------------------------------------

test('ALLOW_WORKFLOW_DRIFT=1 proceeds, but warns and names the consequence', () => {
  // A local `gh auth` token usually carries `workflow` scope, so a developer's
  // push can succeed where CI's cannot. Blocking that outright would get this
  // check deleted.
  const r = run(
    repoWith({ '.github/workflows/suite.yml': 'name: changed\n' }),
    { ALLOW_WORKFLOW_DRIFT: '1' },
  );
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /continuing/);
  assert.match(r.stderr, /'workflow' scope/);
});

// --- wiring -----------------------------------------------------------------

test('run-suite.sh runs the check before it applies anything', () => {
  // The value is entirely in the ordering. Called after the loop starts, this
  // reports a problem the run has already paid for — which is the situation it
  // exists to replace.
  const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'run-suite.sh'), 'utf8');
  const check = src.indexOf('check-baseline-drift.sh');
  // Anchored on the apply CALL, not on `for name in "${FIXTURES[@]}"` — the
  // existing fixture-existence preflight loops over the same variable earlier
  // in the file, so that marker matches the wrong loop.
  const apply = src.indexOf('if "$APPLY" "$name"; then');
  const dryRun = src.indexOf('--dry-run, nothing applied');

  assert.ok(check !== -1, 'run-suite.sh no longer calls the check at all');
  assert.ok(apply !== -1, 'the apply call moved — this test is anchored on it');
  assert.ok(check < apply, 'the check must run before the first fixture is applied');
  // And after the dry-run exit: `--dry-run` opens nothing, so it has no reason
  // to need the network or to fail on a stale tag.
  assert.ok(dryRun < check, 'the check must not run on the --dry-run path');
});

test('only the exact value 1 opens the hatch', () => {
  // A stray `ALLOW_WORKFLOW_DRIFT=` or `=false` must not disable the guard.
  for (const v of ['', '0', 'false', 'yes']) {
    const r = run(
      repoWith({ '.github/workflows/suite.yml': 'name: changed\n' }),
      { ALLOW_WORKFLOW_DRIFT: v },
    );
    assert.equal(r.status, 2, `ALLOW_WORKFLOW_DRIFT=${v} should not bypass`);
  }
});
