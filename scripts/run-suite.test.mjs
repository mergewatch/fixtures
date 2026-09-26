import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, copyFileSync, statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * run-suite.sh's fixture snapshot (mergewatch.ai#584), against throwaway repos.
 *
 * ── Why this harness has the shape it has ──────────────────────────────────
 *
 * The bug is entirely about WHICH COPY of a file runs, so a test that invokes
 * the script the convenient way cannot see it. The E2E gate does, in order:
 *
 *   1. checkout mergewatch/fixtures at origin/main (fetch-depth 0)
 *   2. scripts/select-fixtures.sh            ← from main, pre-reset
 *   3. scripts/reset-env.sh                  ← `git reset --hard e2e-baseline` ON MAIN
 *   4. scripts/run-suite.sh                  ← from the TAG. `git reset --hard`
 *                                              deletes files tracked in the old
 *                                              HEAD and absent from the target,
 *                                              so the whole tree is the tag's.
 *
 * Step 4 is the trap: run-suite.sh, apply-fixture.sh, every meta.env and every
 * overlay/ the run touches is the tag's copy, while grade-run.mjs reads
 * expect.json from origin/main. Two halves of one fixture, from two commits. A
 * fixture fix merged to main did nothing until somebody moved the tag by hand,
 * and the run reported a clean apply while grading the old overlay.
 *
 * So every test here:
 *   * copies scripts/ to a directory OUTSIDE the repo, the way CI now copies it
 *     to $RUNNER_TEMP/fixtures-tooling, and invokes the COPY;
 *   * hard-resets the repo's main to the e2e-baseline tag first, so the tree the
 *     script operates on is the tag's, exactly as in CI.
 *
 * Invoking from inside the reset repo would run the tag's old script. Invoking
 * from this checkout would pass trivially, because nothing would be stale. Both
 * are wrong, and both look like passing tests.
 *
 * The fixture content differs between the tag and main in every repo built
 * here — that is the divergence under test — so an assertion about pushed
 * content is an assertion about which commit supplied it.
 */
const SCRIPTS = resolve(dirname(fileURLToPath(import.meta.url)));

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

function write(dir, relPath, body, mode) {
  mkdirSync(join(dir, dirname(relPath)), { recursive: true });
  writeFileSync(join(dir, relPath), body, mode ? { mode } : undefined);
}

/**
 * Copy scripts/ into `dest`, stamping apply-fixture.sh so its output says WHICH
 * copy of it ran. The tag's copy and main's copy are otherwise identical and
 * both fully functional — a stub that failed would make "the wrong copy ran"
 * indistinguishable from "the script is broken".
 */
function installScripts(dest, marker) {
  mkdirSync(dest, { recursive: true });
  for (const f of readdirSync(SCRIPTS)) {
    if (statSync(join(SCRIPTS, f)).isDirectory()) continue;
    copyFileSync(join(SCRIPTS, f), join(dest, f));
  }
  const p = join(dest, 'apply-fixture.sh');
  const anchor = 'echo "→ Applying overlay from $OVERLAY."';
  const src = readFileSync(p, 'utf8');
  assert.ok(src.includes(anchor), 'apply-fixture.sh lost the line this marker is anchored on');
  writeFileSync(p, src.split(anchor).join(`echo "APPLY_COPY=${marker}"\n${anchor}`), { mode: 0o755 });
  // A relative PREREQ_CHECK resolves against the fixture definition's root, so
  // this file is the tell for which root that was.
  write(dest, 'prereq.sh', `#!/usr/bin/env bash\necho "PREREQ=${marker}"\n`, 0o755);
}

/** A `gh` that answers every call run-suite/apply-fixture makes, and nothing else. */
function installGh(binDir) {
  mkdirSync(binDir, { recursive: true });
  write(binDir, 'gh', `#!/usr/bin/env bash
case "$1 $2" in
  "repo view") echo "test/fixtures"; exit 0 ;;
  "pr list")   exit 0 ;;
  "pr create") echo "https://example.invalid/test/fixtures/pull/1"; exit 0 ;;
  "pr view")   echo 1; exit 0 ;;
  "pr edit"|"pr ready") exit 0 ;;
esac
exit 0
`, 0o755);
}

const META = (branch, extra = '') =>
  `BRANCH=${branch}\nTITLE=fixture commit\nBODY=body\n${extra}`;

/**
 * A fixtures repo in the state CI hands to run-suite.sh.
 *
 * Commit 1 is tagged `e2e-baseline` and holds the OLD fixture definitions.
 * Commit 2 is `origin/main` and holds the NEW ones. Local main is then
 * hard-reset to the tag, which is what reset-env.sh leaves behind — so the
 * working tree, including fixtures/ and scripts/, is the tag's content.
 *
 * `src/`, `.mergewatch.yml` and `.github/workflows/` are deliberately IDENTICAL
 * across the two commits: they are what check-baseline-drift.sh watches, and a
 * difference there would abort every run here for an unrelated reason.
 */
function repoWithDivergence({ renameSecond = false, extraOnMain = {}, prereq = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'suite-'));
  const dir = join(root, 'repo');
  const bare = join(root, 'remote.git');
  const tooling = join(root, 'fixtures-tooling');  // outside `dir`, like $RUNNER_TEMP
  const bin = join(root, 'bin');
  const tmp = join(root, 'tmp');                   // TMPDIR, so leaks are observable
  mkdirSync(dir, { recursive: true });
  mkdirSync(tmp, { recursive: true });
  installGh(bin);

  git(root, 'init', '-q', '--bare', bare);
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.email', 't@example.com');
  git(dir, 'config', 'user.name', 'test');

  // --- commit 1: the baseline, and the OLD fixture definitions --------------
  write(dir, '.gitignore', '.e2e/\n');
  write(dir, 'src/app.ts', 'export const x = 1;\n');
  write(dir, '.mergewatch.yml', 'agents: [security]\n');
  write(dir, '.github/workflows/ci.yml', 'name: ci\n');
  write(dir, 'e2e/impact-map.yml', 'src/**: [correctness]\n');
  write(dir, 'fixtures/01-first/meta.env', META('fixture/01-first'));
  write(dir, 'fixtures/01-first/overlay/src/app.ts', 'OLD-1\n');
  write(dir, 'fixtures/02-second/meta.env', META('fixture/02-second'));
  write(dir, 'fixtures/02-second/overlay/src/app.ts', 'OLD-2\n');
  if (prereq) {
    write(dir, 'fixtures/04-prereq/meta.env',
      META('fixture/04-prereq', 'PREREQ_CHECK=scripts/prereq.sh\n'));
    write(dir, 'fixtures/04-prereq/overlay/src/app.ts', 'OLD-4\n');
  }
  installScripts(join(dir, 'scripts'), 'tag');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'baseline');
  git(dir, 'tag', 'e2e-baseline');
  const baseline = git(dir, 'rev-parse', 'HEAD');

  // --- commit 2: main, with the fixture fixes nobody has re-tagged ----------
  write(dir, 'fixtures/01-first/overlay/src/app.ts', 'NEW-1\n');
  write(dir, 'fixtures/02-second/overlay/src/app.ts', 'NEW-2\n');
  if (renameSecond) write(dir, 'fixtures/02-second/meta.env', META('fixture/02-renamed'));
  if (prereq) write(dir, 'fixtures/04-prereq/overlay/src/app.ts', 'NEW-4\n');
  for (const [p, body] of Object.entries(extraOnMain)) write(dir, p, body);
  installScripts(join(dir, 'scripts'), 'snapshot');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'fixture fixes land on main');
  const mainSha = git(dir, 'rev-parse', 'HEAD');

  git(dir, 'remote', 'add', 'origin', bare);
  git(dir, 'push', '-q', '-u', 'origin', 'main');

  // --- what reset-env.sh leaves behind -------------------------------------
  git(dir, 'reset', '-q', '--hard', baseline);
  assert.equal(readFileSync(join(dir, 'fixtures/01-first/overlay/src/app.ts'), 'utf8'), 'OLD-1\n',
    'the reset did not restore the tag\'s overlay — this harness is not modelling CI');

  // The tooling copy CI invokes, taken from THIS checkout, not from the repo.
  installScripts(tooling, 'outside-copy');

  return { root, dir, bare, tooling, bin, tmp, baseline, mainSha };
}

/** Invoke the OUTSIDE copy of run-suite.sh with the repo as cwd, as CI does. */
function runSuite(r, ...args) {
  return spawnSync('bash', [join(r.tooling, 'run-suite.sh'), ...args], {
    cwd: r.dir,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${r.bin}:${process.env.PATH}`, TMPDIR: r.tmp, SLEEP: '0' },
  });
}

/** A file as the remote received it on a pushed fixture branch. */
const pushed = (r, branch, path) =>
  spawnSync('git', ['--git-dir', r.bare, 'show', `refs/heads/${branch}:${path}`],
    { encoding: 'utf8' });

const manifestOf = (r) => JSON.parse(readFileSync(join(r.dir, '.e2e/last-run.json'), 'utf8'));

// ─── (fails on main) the overlay that gets pushed is the pinned commit's ─────

test('every fixture pushes the pinned commit\'s overlay, the first one included', () => {
  // The whole of #584. Before the snapshot, both of these carried OLD-*: the
  // overlay came from the tag because the tree came from the tag.
  //
  // "the first one included" is not decoration. An earlier design read the
  // overlay from the working tree and relied on it surviving the reset, which
  // works for fixture 2 onwards — by then a previous fixture has already put
  // main's content in the tree — and fails only for the first. A suite that
  // gets fixture 1 wrong and the rest right is the worst possible shape.
  const r = repoWithDivergence();
  const out = runSuite(r, '01-first', '02-second');
  assert.equal(out.status, 0, out.stdout + out.stderr);
  assert.equal(pushed(r, 'fixture/01-first', 'src/app.ts').stdout, 'NEW-1\n');
  assert.equal(pushed(r, 'fixture/02-second', 'src/app.ts').stdout, 'NEW-2\n');
});

test('--snapshot-ref pins the run to the commit CI checked out', () => {
  const r = repoWithDivergence();
  const out = runSuite(r, '--snapshot-ref', r.mainSha, '01-first');
  assert.equal(out.status, 0, out.stdout + out.stderr);
  assert.equal(pushed(r, 'fixture/01-first', 'src/app.ts').stdout, 'NEW-1\n');
  assert.match(out.stdout, /Fixture snapshot: .*@/);
});

test('--snapshot-ref pointing AT the tag reproduces the old behaviour exactly', () => {
  // The control for the test above: same code path, same repo, a different
  // pinned commit. If pinning to the tag did not yield the tag's overlay, the
  // assertions above would not be about the snapshot at all.
  const r = repoWithDivergence();
  const out = runSuite(r, '--snapshot-ref', r.baseline, '01-first');
  assert.equal(out.status, 0, out.stdout + out.stderr);
  assert.equal(pushed(r, 'fixture/01-first', 'src/app.ts').stdout, 'OLD-1\n');
});

test('a fixture that exists on main but not in the tag applies', () => {
  // This failed a production deploy: 98-oversized-diff-skip and
  // 97-marketplace-purchase were merged to main and absent from the tag, and the
  // gate's first full-coverage run died on the preflight that required the tag
  // to have them. It is now the ordinary case.
  const r = repoWithDivergence({
    extraOnMain: {
      'fixtures/03-new/meta.env': META('fixture/03-new'),
      'fixtures/03-new/overlay/src/app.ts': 'NEW-3\n',
    },
  });
  const out = runSuite(r, '03-new');
  assert.equal(out.status, 0, out.stdout + out.stderr);
  assert.equal(pushed(r, 'fixture/03-new', 'src/app.ts').stdout, 'NEW-3\n');
});

test('the apply-fixture.sh that runs is the snapshot\'s, for every fixture', () => {
  // Not just the overlay — the script. apply-fixture.sh is where SKIP_APPLY,
  // PUSH_TO_EXISTING_BRANCH, the step-1 review wait and the PREREQ_CHECK exit-3
  // contract live, so running the tag's copy means a fix to any of those is
  // inert in CI while looking merged.
  const r = repoWithDivergence();
  const out = runSuite(r, '01-first', '02-second');
  assert.equal(out.status, 0, out.stdout + out.stderr);
  const markers = out.stdout.match(/APPLY_COPY=\w[\w-]*/g) ?? [];
  assert.deepEqual(markers, ['APPLY_COPY=snapshot', 'APPLY_COPY=snapshot']);
});

test('a relative PREREQ_CHECK runs the snapshot\'s script', () => {
  const r = repoWithDivergence({ prereq: true });
  const out = runSuite(r, '04-prereq');
  assert.equal(out.status, 0, out.stdout + out.stderr);
  assert.match(out.stdout, /PREREQ=snapshot/);
  assert.doesNotMatch(out.stdout, /PREREQ=tag/);
});

test('the manifest records the branch meta.env names at the pinned commit', () => {
  // The manifest is the grader's only map from fixture to PR. Resolved from the
  // tag's meta.env, a BRANCH renamed on main sends the grader looking for a PR
  // on a branch nothing pushed, and the fixture grades as a missing review —
  // which reads as a product failure.
  const r = repoWithDivergence({ renameSecond: true });
  const out = runSuite(r, '02-second');
  assert.equal(out.status, 0, out.stdout + out.stderr);
  assert.equal(manifestOf(r).fixtures[0].branch, 'fixture/02-renamed');
  assert.equal(pushed(r, 'fixture/02-renamed', 'src/app.ts').stdout, 'NEW-2\n');
  assert.notEqual(pushed(r, 'fixture/02-second', 'src/app.ts').status, 0);
});

// ─── (new behaviour) ─────────────────────────────────────────────────────────

test('the manifest records the pinned sha, so the grader can refuse a mismatch', () => {
  const r = repoWithDivergence();
  const out = runSuite(r, '--snapshot-ref', r.mainSha, '01-first');
  assert.equal(out.status, 0, out.stdout + out.stderr);
  assert.equal(manifestOf(r).snapshot, r.mainSha);
});

// These two cannot fail for the leak on pre-#584 code, because there was no
// snapshot to leak. Both assert the marker as well as the empty tmpdir, so they
// at least prove a snapshot existed and was reclaimed rather than never created —
// an empty TMPDIR alone would pass on any script that does no work at all.

test('the snapshot is removed on a clean exit', () => {
  const r = repoWithDivergence();
  const out = runSuite(r, '01-first');
  assert.equal(out.status, 0, out.stdout + out.stderr);
  assert.match(out.stdout, /Fixture snapshot:/, 'no snapshot was taken, so nothing was cleaned up');
  assert.deepEqual(readdirSync(r.tmp), [], 'the snapshot tmpdir survived the run');
});

test('the snapshot is removed when the run FAILS', () => {
  // The case that actually leaks: a full suite's snapshot is the whole fixtures
  // tree, and a failing gate run is both the largest and the least expected time
  // to leave one behind. `05-noop`'s overlay equals the baseline, so
  // apply-fixture exits 1 with "nothing to commit" — a failure AFTER the snapshot
  // has been taken, which is the only kind that can leak one.
  const r = repoWithDivergence({
    extraOnMain: {
      'fixtures/05-noop/meta.env': META('fixture/05-noop'),
      'fixtures/05-noop/overlay/src/app.ts': 'export const x = 1;\n',
    },
  });
  const out = runSuite(r, '05-noop');
  assert.equal(out.status, 1, out.stdout + out.stderr);
  assert.match(out.stdout, /Fixture snapshot:/, 'no snapshot was taken, so nothing was cleaned up');
  assert.deepEqual(readdirSync(r.tmp), [], 'the snapshot tmpdir survived a failed run');
});

test('an unresolvable --snapshot-ref stops before anything is pushed', () => {
  const r = repoWithDivergence();
  const out = runSuite(r, '--snapshot-ref', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', '01-first');
  assert.equal(out.status, 2, out.stdout + out.stderr);
  assert.match(out.stderr, /does not resolve to a commit/);
  assert.notEqual(pushed(r, 'fixture/01-first', 'src/app.ts').status, 0);
});

test('a fixture absent from the pinned commit names the snapshot, not the tag', () => {
  // The old message said "advance the e2e-baseline tag", which after #584 is the
  // wrong instruction: the tag has nothing to do with whether a fixture exists.
  const r = repoWithDivergence();
  const out = runSuite(r, '99-typo');
  assert.equal(out.status, 2, out.stdout + out.stderr);
  assert.match(out.stderr, /do not exist in/);
  assert.doesNotMatch(out.stderr, /git tag -f e2e-baseline/);
});

test('--dry-run lists the pinned commit\'s fixtures and pushes nothing', () => {
  const r = repoWithDivergence({
    extraOnMain: {
      'fixtures/03-new/meta.env': META('fixture/03-new'),
      'fixtures/03-new/overlay/src/app.ts': 'NEW-3\n',
    },
  });
  const out = runSuite(r, '--dry-run');
  assert.equal(out.status, 0, out.stdout + out.stderr);
  assert.match(out.stdout, /03-new/);
  assert.notEqual(pushed(r, 'fixture/03-new', 'src/app.ts').status, 0);
});
