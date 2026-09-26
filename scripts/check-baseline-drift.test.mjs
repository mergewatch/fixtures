import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
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
  // In the allowlist alongside src/: the review reads it, so a tag whose copy
  // differs from the snapshot's reviews under the wrong configuration.
  write(dir, '.mergewatch.yml', 'agents: [security]\n');
  write(dir, 'README.md', 'baseline\n');
  write(dir, 'e2e/impact-map.yml', 'src/**: [correctness]\n');
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

const run = (dir, env = {}, args = []) =>
  spawnSync('bash', [SCRIPT, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } });

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

test('README-only and e2e-only movement on main is not drift', () => {
  // The negative control for the #584 allowlist, and the reason it is an
  // allowlist rather than an exclusion list. README edits and e2e/ merges are
  // the most common changes on main — this very change is one — and a preflight
  // that blocks the gate on them gets switched off, after which it protects
  // nothing. Fixture 06 does overlay README.md, and it is docs-only and always
  // skipped, so nothing grades against it.
  const r = run(repoWith({
    'README.md': 'hi\n',
    'e2e/impact-map.yml': 'src/**: [correctness, output]\n',
    'docs/notes.md': 'new\n',
  }));
  assert.equal(r.status, 0, r.stderr);
});

// --- #584: the baseline APP must not drift ----------------------------------
//
// Since #584 the overlays, meta.env, expect.json and the scripts all come from a
// pinned snapshot of main. The tag supplies exactly one thing: the code a fixture
// branch is cut from. Overlays are whole-file copies, so every src/ file an
// overlay does not itself replace is inherited from the TAG — and if main has
// moved it, the run reviews a baseline nobody wrote expectations against, while
// every overlay still applies cleanly. Silent, which is the whole complaint in
// #584.

test('src/ drift between the tag and the snapshot aborts', () => {
  const r = run(repoWith({ 'src/app.ts': 'export const x = 2;\n' }));
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /BASELINE APP has drifted/);
  assert.match(r.stderr, /src\/app\.ts/);
  assert.match(r.stderr, /git tag -f e2e-baseline main/);
});

test('.mergewatch.yml drift aborts too — it decides what the review does', () => {
  const r = run(repoWith({ '.mergewatch.yml': 'agents: [security, style]\n' }));
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /\.mergewatch\.yml/);
});

test('baseline drift says out loud that it blocks the deploy and has no override', () => {
  // A blocking check with no hatch is a deliberate choice, and the person it
  // blocks at 2am has to be able to read that choice off the output rather than
  // hunting for the flag that turns it off.
  const r = run(repoWith({ 'src/app.ts': 'export const x = 2;\n' }));
  assert.match(r.stderr, /blocks the deploy/);
  assert.match(r.stderr, /no override/);
});

test('ALLOW_WORKFLOW_DRIFT does not open the baseline-drift check', () => {
  // The hatch exists for one specific thing — a local token that does carry
  // `workflow` scope. Letting it wave through a changed baseline app would make
  // it the flag that disables the check people actually needed.
  const r = run(
    repoWith({ 'src/app.ts': 'export const x = 2;\n' }),
    { ALLOW_WORKFLOW_DRIFT: '1' },
  );
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /BASELINE APP has drifted/);
});

test('workflow drift AND baseline drift: the workflow failure is reported first', () => {
  // Both are stale-tag failures with the same fix, but workflow drift rejects
  // every push outright, so it is the one that has to be named.
  const r = run(repoWith({
    '.github/workflows/suite.yml': 'name: changed\n',
    'src/app.ts': 'export const x = 2;\n',
  }));
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /workflow files have drifted/);
});

// --- #584: the comparison ref is the run's pinned commit --------------------

test('an explicit comparison ref is used instead of origin/main', () => {
  // run-suite.sh pins one commit and drives the whole run from it. A drift
  // report resolved from a DIFFERENT commit describes files the run never reads,
  // and — far worse — a clean report from it does not mean the run is clean.
  const dir = repoWith({ 'src/app.ts': 'export const x = 2;\n' });
  const baseline = git(dir, 'rev-parse', 'e2e-baseline');
  // Pinned AT the tag: identical by definition, so nothing has drifted, even
  // though origin/main has moved src/.
  const pinned = run(dir, {}, [baseline]);
  assert.equal(pinned.status, 0, pinned.stderr);
  // Same repo, no ref: origin/main moved src/, so it fires.
  const floating = run(dir);
  assert.equal(floating.status, 2, floating.stderr);
});

test('the explicit ref is named in the report, not "origin/main"', () => {
  const dir = repoWith({ 'src/app.ts': 'export const x = 2;\n' });
  const head = git(dir, 'rev-parse', 'HEAD');
  const r = run(dir, {}, [head]);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, new RegExp(head));
});

test('an unresolvable comparison ref fails loudly rather than falling back', () => {
  // Falling back to origin/main here would be the #584 bug in miniature: the
  // check would silently answer a question nobody asked.
  const r = run(repoWith({}), {}, ['deadbeefdeadbeefdeadbeefdeadbeefdeadbeef']);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /cannot resolve comparison ref/);
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
  // #584 — and it must be handed the commit the run is pinned to. Left to its
  // own `git fetch origin main`, it would answer about a commit the run does not
  // read, and a clean answer from it would mean nothing.
  assert.match(src, /check-baseline-drift\.sh" "\$SNAPSHOT_SHA"/);
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

// --- #584: the allowlist must keep matching what overlays actually write -----

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The paths the baseline-drift check watches, read OUT OF THE SCRIPT rather than
 * restated here. Two copies of an allowlist is two things that can disagree, and
 * the failure mode of disagreement is a guard that quietly watches the wrong set.
 */
function allowlistFromScript() {
  const line = readFileSync(SCRIPT, 'utf8')
    .split('\n')
    .find((l) => l.startsWith('BASELINE_DRIFT='));
  assert.ok(line, 'BASELINE_DRIFT= line not found — this guard is anchored on it');
  const m = line.match(/ -- (.+)\)"$/);
  assert.ok(m, `could not parse pathspecs out of: ${line}`);
  return m[1].trim().split(/\s+/);
}

test('the drift allowlist is exactly src/ and .mergewatch.yml', () => {
  // Anchors the rest of this file. If someone widens the pathspec, the guard
  // below silently starts checking a different question.
  assert.deepEqual(allowlistFromScript(), ['src/', '.mergewatch.yml']);
});

test('no overlay writes a baseline path outside the allowlist', () => {
  // The allowlist is only safe while it covers every path an overlay can
  // INHERIT from the tag. A path an overlay writes that also exists in the
  // baseline is drift-capable: main can move it, the tag can lag, and the run
  // reviews the tag's copy while grading against main's expectations.
  //
  // Checked against HEAD's tracked tree rather than the e2e-baseline tag on
  // purpose: this repo's CI checks out at depth 1 with no tags, so a tag-based
  // assertion would not run where it matters — and a guard that cannot run in CI
  // is #584's own defect wearing a different hat. HEAD and the tag hold the same
  // set of top-level paths; what differs between them is content, which is
  // exactly what the script itself compares.
  const allowed = [...allowlistFromScript(), 'README.md'];
  const tracked = new Set(
    spawnSync('git', ['ls-tree', '-r', '--name-only', 'HEAD'], { cwd: REPO, encoding: 'utf8' })
      .stdout.split('\n').filter(Boolean),
  );

  const overlayPaths = [];
  const fixtures = join(REPO, 'fixtures');
  for (const name of readdirSync(fixtures)) {
    const overlay = join(fixtures, name, 'overlay');
    if (!existsSync(overlay) || !statSync(overlay).isDirectory()) continue;
    const walk = (abs, rel) => {
      for (const e of readdirSync(abs, { withFileTypes: true })) {
        const nextRel = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) walk(join(abs, e.name), nextRel);
        else overlayPaths.push([name, nextRel]);
      }
    };
    walk(overlay, '');
  }
  assert.ok(overlayPaths.length > 0, 'found no overlay files — this guard is vacuous');

  const escaped = overlayPaths.filter(([, p]) =>
    tracked.has(p) && !allowed.some((a) => (a.endsWith('/') ? p.startsWith(a) : p === a)));

  assert.deepEqual(
    escaped, [],
    'these overlay paths exist in the baseline but sit outside the drift allowlist, '
    + 'so main can move them under a stale tag without the preflight noticing. '
    + 'Either add the path to BASELINE_DRIFT\'s pathspec in check-baseline-drift.sh, '
    + `or stop overlaying a tracked baseline file: ${JSON.stringify(escaped)}`,
  );
});
