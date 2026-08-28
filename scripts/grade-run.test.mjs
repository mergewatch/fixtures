import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * grade-run.mjs's expectation source (fixtures#1211), against throwaway git
 * repos.
 *
 * The bug these cover is not a wrong answer — it is a RIGHT-LOOKING answer
 * read from the wrong tree. By the time grading runs, run-suite.sh has left
 * the repo on the last fixture branch (cut from e2e-baseline) and reset-env.sh
 * has reset main to that tag, so `fixtures/<n>/expect.json` on disk is
 * whatever the tag holds. Fixtures then grade UNGRADED, UNGRADED does not
 * fail, and the run exits 0 having asserted nothing.
 *
 * Building the repo states directly is the only way to prove it: reproducing
 * it for real costs a full suite run, and the symptom is silence.
 *
 * No network. Every case either stops at the guard or has a manifest with no
 * gradeable PRs, so nothing reaches `gh`.
 */
const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'grade-run.mjs');

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
 * A repo whose HEAD tree has NO expectations while origin/main has two —
 * exactly the shape run-suite.sh leaves behind.
 */
function repoWithStaleTree() {
  const dir = mkdtempSync(join(tmpdir(), 'grade-run-'));
  git(dir, 'init', '--quiet', '-b', 'main');
  git(dir, 'config', 'user.email', 'e2e@test');
  git(dir, 'config', 'user.name', 'e2e');
  for (const f of ['a', 'b']) write(dir, `fixtures/${f}/meta.env`, 'TAGS=correctness\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '--quiet', '-m', 'fixtures, no expectations yet');
  const baseline = git(dir, 'rev-parse', 'HEAD');

  for (const f of ['a', 'b']) write(dir, `fixtures/${f}/expect.json`, '{"comment":"present"}');
  git(dir, 'add', '-A');
  git(dir, 'commit', '--quiet', '-m', 'add expectations');
  const tooling = git(dir, 'rev-parse', 'HEAD');

  git(dir, 'update-ref', 'refs/remotes/origin/main', tooling);
  // Leave the working tree where a suite run would: on the pre-tooling commit.
  git(dir, 'checkout', '--quiet', '--detach', baseline);
  return { dir, baseline, tooling };
}

function manifest(dir, name, fixtures) {
  const p = join(dir, name);
  writeFileSync(p, JSON.stringify({ repo: 'acme/fixtures', total: fixtures.length, fixtures }));
  return p;
}

function run(dir, ...args) {
  return spawnSync('node', [SCRIPT, ...args], { cwd: dir, encoding: 'utf8' });
}

test('expectations come from origin/main, not the checked-out tree', () => {
  const { dir } = repoWithStaleTree();
  const m = manifest(dir, 'm.json', [{ fixture: 'a', branch: 'x', pr: null, applied: 'ok' }]);
  const r = run(dir, '--manifest', m);
  // The tree it is standing on has zero. Reading two proves it did not use it.
  assert.match(r.stdout, /expectations: origin\/main @ \w+ · 2 expect\.json/);
  assert.equal(r.status, 0);
});

test('the resolved source is always printed, with the unused tree named', () => {
  const { dir } = repoWithStaleTree();
  const m = manifest(dir, 'm.json', [{ fixture: 'a', branch: 'x', pr: null, applied: 'ok' }]);
  const r = run(dir, '--manifest', m);
  assert.match(r.stdout, /working tree is at \w+ — not used/);
});

test('--expect-ref worktree opts back in for local iteration', () => {
  const { dir } = repoWithStaleTree();
  const m = manifest(dir, 'm.json', [{ fixture: 'a', branch: 'x', pr: null, applied: 'ok' }]);
  const r = run(dir, '--manifest', m, '--expect-ref', 'worktree');
  assert.match(r.stdout, /expectations: working tree · 0 expect\.json/);
});

test('zero expectations against a gradeable manifest refuses with exit 2', () => {
  const { dir, baseline } = repoWithStaleTree();
  const m = manifest(dir, 'm.json', [{ fixture: 'a', branch: 'x', pr: 7, applied: 'ok' }]);
  const r = run(dir, '--manifest', m, '--expect-ref', baseline);
  // Without this the run grades everything UNGRADED and exits 0 — green, and
  // having asserted nothing. That is the failure mode, so it must be loud.
  assert.equal(r.status, 2);
  assert.match(r.stderr, /No expect\.json found/);
  assert.match(r.stderr, /refusing/);
  assert.match(r.stderr, /--expect-ref origin\/main/);
});

test('zero expectations with nothing gradeable is not an error', () => {
  const { dir, baseline } = repoWithStaleTree();
  // A manual-only selection legitimately has no PRs to grade. The guard must
  // not turn that into a failure.
  const m = manifest(dir, 'm.json', [{ fixture: 'a', branch: 'x', pr: null, applied: 'ok' }]);
  const r = run(dir, '--manifest', m, '--expect-ref', baseline);
  assert.equal(r.status, 0);
});

test('a prereq-skipped fixture does not count as gradeable', () => {
  const { dir, baseline } = repoWithStaleTree();
  const m = manifest(dir, 'm.json', [
    { fixture: 'a', branch: 'x', pr: 7, applied: 'skipped-missing-prereq' },
  ]);
  const r = run(dir, '--manifest', m, '--expect-ref', baseline);
  assert.equal(r.status, 0);
});

test('an unresolvable ref falls back to the tree and says so', () => {
  const { dir } = repoWithStaleTree();
  const m = manifest(dir, 'm.json', [{ fixture: 'a', branch: 'x', pr: null, applied: 'ok' }]);
  const r = run(dir, '--manifest', m, '--expect-ref', 'origin/nope');
  // Refusing to grade at all would be worse than grading from the tree, so
  // long as the substitution is announced.
  assert.match(r.stdout, /working tree \(no origin\/nope\)/);
  assert.equal(r.status, 0);
});

test('a missing manifest still exits 2 rather than grading nothing', () => {
  const { dir } = repoWithStaleTree();
  const r = run(dir, '--manifest', join(dir, 'absent.json'));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /No manifest/);
});
