import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
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

// ─── #536 — cost accounting ─────────────────────────────────────────────────
//
// The suite spends real money per fixture and reported none of it, so every
// statement about fixture cost was an estimate. One such estimate was wrong by
// 4x, in the direction that made the problem look worse than it was, and there
// was no number anywhere to check it against.
//
// These drive the real script through a `gh` shim rather than unit-testing a
// parser, because the thing that can silently break is the match between what
// the formatter EMITS and what the grader READS — and only an end-to-end run
// exercises that pairing.

/** A repo with expectations on origin/main, ready to grade `names`. */
function repoWithExpectations(names) {
  const dir = mkdtempSync(join(tmpdir(), 'grade-cost-'));
  git(dir, 'init', '--quiet', '-b', 'main');
  git(dir, 'config', 'user.email', 'e2e@test');
  git(dir, 'config', 'user.name', 'e2e');
  for (const f of names) {
    write(dir, `fixtures/${f}/meta.env`, 'TAGS=correctness\n');
    write(dir, `fixtures/${f}/expect.json`, '{"comment":"present"}');
  }
  git(dir, 'add', '-A');
  git(dir, 'commit', '--quiet', '-m', 'fixtures + expectations');
  git(dir, 'update-ref', 'refs/remotes/origin/main', git(dir, 'rev-parse', 'HEAD'));
  return dir;
}

/**
 * `gh` shim. `bodies` maps PR number -> the bot comment body to serve.
 * Everything else returns an empty array, which the grader tolerates.
 */
function ghShim(dir, bodies) {
  const binDir = mkdtempSync(join(tmpdir(), 'gh-bin-'));
  const map = JSON.stringify(bodies);
  writeFileSync(join(binDir, 'gh'), `#!/usr/bin/env node
const args = process.argv.slice(2);
const bodies = ${JSON.stringify(map)};
const byPr = JSON.parse(bodies);
if (args[0] === 'pr' && args[1] === 'view') {
  const n = args[2];
  const body = byPr[n];
  process.stdout.write(JSON.stringify({
    headRefOid: 'deadbeef',
    state: 'OPEN',
    comments: body ? [{ body, author: { login: 'mergewatch' } }] : [],
    reviews: [], statusCheckRollup: [], reactionGroups: [],
  }));
  process.exit(0);
}
process.stdout.write('[]');
`);
  spawnSync('chmod', ['755', join(binDir, 'gh')]);
  return binDir;
}

function runWithGh(dir, binDir, ...args) {
  return spawnSync('node', [SCRIPT, ...args], {
    cwd: dir, encoding: 'utf8',
    env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` },
  });
}

const costBlock = (usd, inTok, outTok) =>
  `<!-- mergewatch-review -->\n> 🟢 **5/5 — ok**\n\n| **Tokens** | ${inTok} in · ${outTok} out · 1 total |\n| **Est. cost** | ~$${usd} (LLM only) |\n`;

test('#536 — totals the per-fixture cost and prints it last, for the job summary', () => {
  const dir = repoWithExpectations(['a', 'b']);
  const bin = ghShim(dir, { 1: costBlock('0.2000', '1,000', '100'), 2: costBlock('0.1000', '2,500', '250') });
  const mf = manifest(dir, 'run.json', [
    { fixture: 'a', pr: 1, applied: 'ok' }, { fixture: 'b', pr: 2, applied: 'ok' },
  ]);
  const r = runWithGh(dir, bin, '--manifest', mf);
  assert.match(r.stdout, /Suite cost: ~\$0\.30 across 2 reviewed fixture\(s\)/, r.stdout + r.stderr);
  // Tokens are summed across fixtures, commas parsed rather than truncated.
  assert.match(r.stdout, /3,500 in \/ 350 out tokens/);
  // Last line matters: the gate summary lifts `tail -40`, so anything printed
  // before the fixture listing would not survive a 48-fixture run.
  const lines = r.stdout.trimEnd().split('\n');
  assert.ok(lines.slice(-8).some((l) => l.includes('Suite cost:')), 'cost must be near the end');
});

test('#536 — a fixture with no cost block is named, never counted as $0', () => {
  // The whole point. Silently summing an unmeasured fixture as free understates
  // the suite in exactly the way this issue exists to stop.
  const dir = repoWithExpectations(['a', 'b']);
  const bin = ghShim(dir, { 1: costBlock('0.2000', '1,000', '100'), 2: '<!-- mergewatch-review -->\n> 🟢 **5/5 — ok**\n' });
  const mf = manifest(dir, 'run.json', [
    { fixture: 'a', pr: 1, applied: 'ok' }, { fixture: 'b', pr: 2, applied: 'ok' },
  ]);
  const r = runWithGh(dir, bin, '--manifest', mf);
  assert.match(r.stdout, /Suite cost: ~\$0\.20 across 1 reviewed fixture\(s\)/, r.stdout);
  assert.match(r.stdout, /1 fixture\(s\) reported no cost and are NOT in that total: b/);
});

test('#536 — a re-reviewed PR is counted at its cumulative cost, not the last run', () => {
  // The formatter switches format once a PR has been reviewed twice. Reading
  // the first number would undercount every re-reviewed fixture, and the suite
  // re-reviews routinely (18b pushes onto 18a).
  const dir = repoWithExpectations(['a']);
  const body = '<!-- mergewatch-review -->\n> 🟢 **5/5 — ok**\n\n'
    + '| **Est. cost** | ~$0.1000 this run · ~$0.7500 total for PR (LLM only) |\n';
  const bin = ghShim(dir, { 1: body });
  const mf = manifest(dir, 'run.json', [{ fixture: 'a', pr: 1, applied: 'ok' }]);
  const r = runWithGh(dir, bin, '--manifest', mf);
  assert.match(r.stdout, /Suite cost: ~\$0\.75 /, r.stdout);
});

test('#536 — per-fixture costs are listed most expensive first', () => {
  const dir = repoWithExpectations(['cheap', 'pricey']);
  const bin = ghShim(dir, { 1: costBlock('0.0100', '1', '1'), 2: costBlock('0.9000', '1', '1') });
  const mf = manifest(dir, 'run.json', [
    { fixture: 'cheap', pr: 1, applied: 'ok' }, { fixture: 'pricey', pr: 2, applied: 'ok' },
  ]);
  const r = runWithGh(dir, bin, '--manifest', mf);
  const at = (n) => r.stdout.indexOf(n);
  assert.ok(at('pricey') < at('cheap') || at('$0.9000') < at('$0.0100'), r.stdout);
});

test('#536 — totals are written back into the manifest for local /verify-suite', () => {
  const dir = repoWithExpectations(['a']);
  const bin = ghShim(dir, { 1: costBlock('0.2500', '10', '5') });
  const mf = manifest(dir, 'run.json', [{ fixture: 'a', pr: 1, applied: 'ok' }]);
  runWithGh(dir, bin, '--manifest', mf);
  const saved = JSON.parse(readFileSync(mf, 'utf8'));
  assert.equal(saved.cost.measuredCount, 1);
  assert.ok(Math.abs(saved.cost.totalUsd - 0.25) < 1e-9, JSON.stringify(saved.cost));
  // The original manifest content survives — this appends, it does not replace.
  assert.equal(saved.fixtures.length, 1);
});

test('#536 — --json carries the same totals', () => {
  const dir = repoWithExpectations(['a']);
  const bin = ghShim(dir, { 1: costBlock('0.3300', '7', '3') });
  const mf = manifest(dir, 'run.json', [{ fixture: 'a', pr: 1, applied: 'ok' }]);
  const r = runWithGh(dir, bin, '--manifest', mf, '--json');
  const out = JSON.parse(r.stdout);
  assert.ok(Math.abs(out.cost.totalUsd - 0.33) < 1e-9, r.stdout.slice(0, 300));
  assert.equal(out.cost.perFixture[0].fixture, 'a');
});
