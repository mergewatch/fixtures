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

function manifest(dir, name, fixtures, extra = {}) {
  const p = join(dir, name);
  writeFileSync(p, JSON.stringify({ repo: 'acme/fixtures', total: fixtures.length, ...extra, fixtures }));
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

// ─── #560 — a failure the diff cannot explain should say so ─────────────────
//
// Twice in one week a fixture failed on a change that could not have touched
// it — 29-cluster on a YAML permissions block, 22-claim-aware-verify on token
// accounting — and each blocked a production deploy while someone worked out
// the failure was unrelated. The selector already knew: both runs swept the
// whole suite via a blanket rule, so no fixture was specifically implicated.
// That fact was thrown away between selection and grading.

/** A manifest carrying a selection reason. */
function manifestWithSelection(dir, name, fixtures, selection) {
  const p = join(dir, name);
  writeFileSync(p, JSON.stringify({ repo: 'acme/fixtures', total: fixtures.length, selection, fixtures }));
  return p;
}

/** gh shim serving a comment that fails a `comment: present` expectation. */
function ghFailing(dir) {
  const binDir = mkdtempSync(join(tmpdir(), 'gh-fail-'));
  writeFileSync(join(binDir, 'gh'), `#!/usr/bin/env node
const a = process.argv.slice(2);
if (a[0] === 'pr' && a[1] === 'view') {
  process.stdout.write(JSON.stringify({ headRefOid: 'x', state: 'OPEN', comments: [], reviews: [], statusCheckRollup: [], reactionGroups: [] }));
  process.exit(0);
}
process.stdout.write('[]');
`);
  spawnSync('chmod', ['755', join(binDir, 'gh')]);
  return binDir;
}

function gradeWith(selection) {
  const dir = mkdtempSync(join(tmpdir(), 'grade-sel-'));
  git(dir, 'init', '--quiet', '-b', 'main');
  git(dir, 'config', 'user.email', 'e2e@test');
  git(dir, 'config', 'user.name', 'e2e');
  write(dir, 'fixtures/a/meta.env', 'TAGS=correctness\n');
  write(dir, 'fixtures/a/expect.json', '{"comment":"present"}');
  git(dir, 'add', '-A');
  git(dir, 'commit', '--quiet', '-m', 'f');
  git(dir, 'update-ref', 'refs/remotes/origin/main', git(dir, 'rev-parse', 'HEAD'));
  const mf = manifestWithSelection(dir, 'run.json', [{ fixture: 'a', pr: 1, applied: 'ok' }], selection);
  const bin = ghFailing(dir);
  return spawnSync('node', [SCRIPT, '--manifest', mf], {
    cwd: dir, encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  });
}

test('#560 — a blanket ALL rule is disclosed on a failure', () => {
  const r = gradeWith('all:rule');
  assert.match(r.stdout, /✗ FAIL/, r.stdout);
  assert.match(r.stdout, /blanket ALL impact-map rule/, r.stdout);
  assert.match(r.stdout, /not specifically implicated/, r.stdout);
});

test('#560 — an unmapped path is named, so the fix is obvious', () => {
  // Naming the path turns "why did everything run" into a one-line answer:
  // add it to the impact map.
  const r = gradeWith('all:unmapped:.github/workflows/deploy.yml');
  assert.match(r.stdout, /\.github\/workflows\/deploy\.yml/, r.stdout);
  assert.match(r.stdout, /matches no impact-map rule/, r.stdout);
});

test('#560 — a tag-matched selection adds NO note', () => {
  // The fixture WAS specifically implicated, so the failure reads as a plain
  // failure. Softening every failure would be worse than saying nothing.
  const r = gradeWith('tags:inline,fp');
  assert.match(r.stdout, /✗ FAIL/, r.stdout);
  assert.doesNotMatch(r.stdout, /not specifically implicated/);
});

test('#560 — a human-named run adds no note', () => {
  const r = gradeWith('explicit');
  assert.doesNotMatch(r.stdout, /not specifically implicated/);
});

test('#560 — a manifest with no selection field still grades', () => {
  // Back-compat: manifests written before this change, and hand-written ones.
  const r = gradeWith(undefined);
  assert.match(r.stdout, /✗ FAIL/, r.stdout);
  assert.doesNotMatch(r.stdout, /not specifically implicated/);
});

test('#560 — the failure still FAILS; this annotates, it does not excuse', () => {
  // The whole point is attribution without exculpation. A blanket-selected
  // failure must still exit non-zero and still block the gate.
  assert.notEqual(gradeWith('all:rule').status, 0);
});

test('#560 — a selection reason containing a quote does not corrupt the manifest', () => {
  // Review finding on fixtures#2122: `all:unmapped:<path>` carries a real
  // filename from `git diff --name-only`, and a filename may legally contain a
  // double quote or a backslash. Unescaped, that produces malformed JSON and
  // the grader's JSON.parse throws — killing the ENTIRE grading step, not just
  // the note. run-suite escapes it; this asserts the grader survives the value.
  const r = gradeWith('all:unmapped:src/we"ird\\path.ts');
  assert.match(r.stdout, /✗ FAIL/, r.stdout + r.stderr);
  assert.match(r.stdout, /matches no impact-map rule/, r.stdout);
  assert.match(r.stdout, /we"ird/, r.stdout);
});

// ─── #561 — a total absence of cost is a parser break, not a cheap run ──────
//
// The cost block is parsed out of the review comment's details table. A
// formatter change stops the regex matching and the suite total silently
// collapses to $0.00 — which reads as GOOD news, and in the direction that
// makes the cost work look finished. Naming it is the guard.

/** gh shim serving a comment with or without a cost block. */
function ghWithCost(dir, bodies) {
  const binDir = mkdtempSync(join(tmpdir(), 'gh-cost-'));
  writeFileSync(join(binDir, 'gh'), `#!/usr/bin/env node
const a = process.argv.slice(2);
const byPr = ${JSON.stringify(JSON.stringify(bodies))};
if (a[0] === 'pr' && a[1] === 'view') {
  const body = JSON.parse(byPr)[a[2]];
  process.stdout.write(JSON.stringify({
    headRefOid: 'x', state: 'OPEN',
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

function gradeCosts(bodies) {
  const names = Object.keys(bodies).map((_, i) => `f${i}`);
  const dir = mkdtempSync(join(tmpdir(), 'grade-561-'));
  git(dir, 'init', '--quiet', '-b', 'main');
  git(dir, 'config', 'user.email', 'e2e@test');
  git(dir, 'config', 'user.name', 'e2e');
  for (const n of names) {
    write(dir, `fixtures/${n}/meta.env`, 'TAGS=correctness\n');
    write(dir, `fixtures/${n}/expect.json`, '{"comment":"present"}');
  }
  git(dir, 'add', '-A');
  git(dir, 'commit', '--quiet', '-m', 'f');
  git(dir, 'update-ref', 'refs/remotes/origin/main', git(dir, 'rev-parse', 'HEAD'));
  const entries = names.map((n, i) => ({ fixture: n, pr: i + 1, applied: 'ok' }));
  const mf = manifest(dir, 'run.json', entries);
  const bin = ghWithCost(dir, Object.fromEntries(Object.values(bodies).map((b, i) => [String(i + 1), b])));
  return spawnSync('node', [SCRIPT, '--manifest', mf], {
    cwd: dir, encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  });
}

const withCost = (usd) => `<!-- mergewatch-review -->\n> 🟢 **5/5 — ok**\n\n| **Est. cost** | ~$${usd} (LLM only) |\n`;
const noCost = '<!-- mergewatch-review -->\n> 🟢 **5/5 — ok**\n';

test('#561 — every reviewed fixture missing a cost is called a PARSER failure', () => {
  const r = gradeCosts({ a: noCost, b: noCost });
  assert.match(r.stdout, /Suite cost: UNKNOWN/, r.stdout);
  assert.match(r.stdout, /PARSER failure, not a cheap run/, r.stdout);
  // Never render the misleading number.
  assert.doesNotMatch(r.stdout, /Suite cost: ~\$0\.00/);
});

test('#561 — it names where to look, not just that something is wrong', () => {
  const r = gradeCosts({ a: noCost });
  assert.match(r.stdout, /comment-formatter\.ts against parseReviewCost/, r.stdout);
});

test('#561 — a partial absence still reports the total, as before', () => {
  // One fixture missing a cost is normal (a skip-assertion fixture posts no
  // review). Only a TOTAL absence indicates the parser.
  const r = gradeCosts({ a: withCost('0.2000'), b: noCost });
  assert.match(r.stdout, /Suite cost: ~\$0\.20 across 1 reviewed fixture/, r.stdout);
  assert.doesNotMatch(r.stdout, /PARSER failure/);
});

test('#561 — a healthy run is unchanged', () => {
  const r = gradeCosts({ a: withCost('0.1000'), b: withCost('0.2000') });
  assert.match(r.stdout, /Suite cost: ~\$0\.30 across 2 reviewed fixture/, r.stdout);
  assert.doesNotMatch(r.stdout, /UNKNOWN/);
});

// ─── #561 phase 3 — prefer the payload, keep the prose fallback ─────────────
//
// The prose parser reads a details table across a REPO BOUNDARY. A formatter
// change stops it matching and every fixture reports unknown — loud since
// phase 1, but loud-and-broken is still broken. The payload is emitted by the
// same code that renders the table, so the two cannot disagree.
//
// The fallback stays because phase 2 shipped on 2026-09-08: reviews posted
// before that, and stages not yet redeployed, carry no payload. Removing it
// would trade a drift bug for a rollout bug.

const PAYLOAD = (o) => `<!-- mw-cost:${JSON.stringify(o)} -->`;
const PROSE = (usd, inTok, outTok) =>
  `| **Tokens** | ${inTok} in · ${outTok} out · 1 total |\n| **Est. cost** | ~$${usd} (LLM only) |`;

test('#561 — the payload is used when present', () => {
  const r = gradeCosts({ a: `<!-- mergewatch-review -->\n> 🟢 **5/5**\n\n${PAYLOAD({ inputTokens: 100, outputTokens: 20, estimatedCostUsd: 0.5 })}\n` });
  assert.match(r.stdout, /Suite cost: ~\$0\.50 across 1 reviewed fixture/, r.stdout);
  assert.match(r.stdout, /100 in \/ 20 out tokens/, r.stdout);
});

test('#561 — the payload WINS when it and the prose disagree', () => {
  // They should never disagree — the formatter emits both from the same
  // numbers — but if they ever do, the machine-readable one is authoritative
  // and this makes that explicit rather than order-dependent.
  const body = `<!-- mergewatch-review -->\n${PROSE('9.9999', '1', '1')}\n${PAYLOAD({ inputTokens: 100, outputTokens: 20, estimatedCostUsd: 0.5 })}\n`;
  const r = gradeCosts({ a: body });
  assert.match(r.stdout, /~\$0\.50/, r.stdout);
  assert.doesNotMatch(r.stdout, /9\.99/);
});

test('#561 — falls back to the prose when there is no payload', () => {
  // A review from before phase 2, or from a stage not yet redeployed.
  const r = gradeCosts({ a: `<!-- mergewatch-review -->\n${PROSE('0.2000', '1,000', '100')}\n` });
  assert.match(r.stdout, /Suite cost: ~\$0\.20 across 1 reviewed fixture/, r.stdout);
});

test('#561 — a malformed payload falls back rather than throwing', () => {
  // Throwing would take down the whole grading step, not one fixture's cost.
  const body = `<!-- mergewatch-review -->\n<!-- mw-cost:{not json} -->\n${PROSE('0.3000', '5', '5')}\n`;
  const r = gradeCosts({ a: body });
  assert.match(r.stdout, /Suite cost: ~\$0\.30/, r.stdout);
});

test('#561 — a re-review payload uses the cumulative figure', () => {
  // Matches the prose rule: a re-reviewed PR's real spend is the cumulative
  // total, not the most recent run.
  const r = gradeCosts({ a: `<!-- mergewatch-review -->\n${PAYLOAD({ estimatedCostUsd: 0.1, cumulativeCostUsd: 0.75 })}\n` });
  assert.match(r.stdout, /~\$0\.75/, r.stdout);
});

test('#561 — an empty payload is unmeasured, consistent with a no-cost review', () => {
  // I first asserted `{}` should count as "genuinely zero" rather than
  // unknown. That was a distinction I invented: the formatter emits `{}`
  // exactly when it also omits the cost ROW, so `{}` and "no cost reported"
  // are the same state — and the 7 assert-no-review fixtures already land in
  // `unknown` and get NAMED. Treating one of them differently would split one
  // condition across two reports.
  //
  // What matters is that it does not throw and does not silently become $0.00.
  const r = gradeCosts({ a: `<!-- mergewatch-review -->\n${PAYLOAD({})}\n` });
  assert.match(r.stdout, /Suite cost: UNKNOWN/, r.stdout);
  assert.doesNotMatch(r.stdout, /Suite cost: ~\$0\.00/);
});

// ─── #584 — the overlays and the expectations must be the same commit ────────
//
// Before run-suite.sh pinned a snapshot, they routinely were not. The gate
// resets the tree to the e2e-baseline tag before the suite, so overlays came
// from the tag; this script has always read expect.json from origin/main.
// Editing expect.json took effect immediately, editing overlay/ did nothing, and
// the output said `expectations: origin/main @ <sha>` either way. A fixture fix
// was diagnosed as wrong twice because of it.
//
// run-suite.sh now writes the commit it pinned into the manifest as `snapshot`.
// These cover the refusal, and — more importantly — the two cases that must NOT
// refuse, because a preflight that blocks legitimate local runs gets removed.

test('an explicit --expect-ref that disagrees with the manifest snapshot exits 2', () => {
  const dir = repoWithExpectations(['a']);
  const bin = ghShim(dir, { 1: costBlock('0.1000', '10', '1') });
  const mf = manifest(dir, 'run.json', [{ fixture: 'a', pr: 1, applied: 'ok' }],
    { snapshot: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' });
  const r = runWithGh(dir, bin, '--manifest', mf, '--expect-ref', 'origin/main');
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /snapshot and expectation source disagree/);
  // Both sides named, or the reader cannot tell which half is stale.
  assert.match(r.stderr, /overlays came from aaaaaaa, expectations from \w{7}/);
});

test('a manifest with no snapshot at all is refused under an explicit --expect-ref', () => {
  // Every manifest written before #584 looks like this, and so does any manifest
  // written by something other than run-suite.sh. In CI — the one place that
  // passes --expect-ref — that is not a run worth grading.
  const dir = repoWithExpectations(['a']);
  const bin = ghShim(dir, { 1: costBlock('0.1000', '10', '1') });
  const mf = manifest(dir, 'run.json', [{ fixture: 'a', pr: 1, applied: 'ok' }]);
  const r = runWithGh(dir, bin, '--manifest', mf, '--expect-ref', 'origin/main');
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /records no `snapshot`/);
});

test('the failure is an ERROR, not a note printed above a green verdict', () => {
  // #584's whole complaint is silence. A warning over a passing run reads as
  // "noted", which is how this class of defect survives — see #626/#634/#640.
  const dir = repoWithExpectations(['a']);
  const bin = ghShim(dir, { 1: costBlock('0.1000', '10', '1') });
  const mf = manifest(dir, 'run.json', [{ fixture: 'a', pr: 1, applied: 'ok' }],
    { snapshot: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' });
  const r = runWithGh(dir, bin, '--manifest', mf, '--expect-ref', 'origin/main');
  assert.doesNotMatch(r.stdout, /Suite cost/, 'it graded anyway');
  assert.match(r.stderr, /^✗/m);
});

test('a matching snapshot grades normally and says nothing', () => {
  const dir = repoWithExpectations(['a']);
  const bin = ghShim(dir, { 1: costBlock('0.1000', '10', '1') });
  const sha = git(dir, 'rev-parse', 'origin/main');
  const mf = manifest(dir, 'run.json', [{ fixture: 'a', pr: 1, applied: 'ok' }], { snapshot: sha });
  const r = runWithGh(dir, bin, '--manifest', mf, '--expect-ref', 'origin/main');
  assert.doesNotMatch(r.stderr, /disagree/);
  assert.match(r.stdout, /Suite cost/, r.stdout + r.stderr);
});

test('a SHORT --expect-ref matching the same commit is not a mismatch', () => {
  // The comparison is on resolved commits, never on the ref STRING. `--expect-ref
  // <short sha>` and a full-sha snapshot name one commit; comparing text would
  // reject it, and a preflight with false positives gets switched off.
  const dir = repoWithExpectations(['a']);
  const bin = ghShim(dir, { 1: costBlock('0.1000', '10', '1') });
  const sha = git(dir, 'rev-parse', 'origin/main');
  const mf = manifest(dir, 'run.json', [{ fixture: 'a', pr: 1, applied: 'ok' }], { snapshot: sha });
  const r = runWithGh(dir, bin, '--manifest', mf, '--expect-ref', sha.slice(0, 8));
  assert.doesNotMatch(r.stderr, /disagree/, r.stdout + r.stderr);
  assert.match(r.stdout, /Suite cost/, r.stdout + r.stderr);
});

test('a local run with no --expect-ref warns but still grades', () => {
  // A developer running /verify-suite by hand has not claimed anything about
  // which commit anything came from. Refusing there would make the escape hatch
  // "stop using grade-run", which is worse than a warning.
  const dir = repoWithExpectations(['a']);
  const bin = ghShim(dir, { 1: costBlock('0.1000', '10', '1') });
  const mf = manifest(dir, 'run.json', [{ fixture: 'a', pr: 1, applied: 'ok' }],
    { snapshot: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' });
  const r = runWithGh(dir, bin, '--manifest', mf);
  assert.match(r.stderr, /^⚠/m);
  assert.match(r.stdout, /Suite cost/, r.stdout + r.stderr);
});

test('--expect-ref worktree warns but still grades', () => {
  // The documented way to iterate on expectations without committing them. It is
  // an explicit statement that the two halves differ, so refusing would break
  // the only workflow that legitimately wants the mismatch.
  const dir = repoWithExpectations(['a']);
  const bin = ghShim(dir, { 1: costBlock('0.1000', '10', '1') });
  const mf = manifest(dir, 'run.json', [{ fixture: 'a', pr: 1, applied: 'ok' }],
    { snapshot: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' });
  const r = runWithGh(dir, bin, '--manifest', mf, '--expect-ref', 'worktree');
  assert.match(r.stderr, /^⚠/m);
  assert.match(r.stdout, /Suite cost/, r.stdout + r.stderr);
});

// ─── mergewatch.ai#659 — "the review errored" vs "the review disagreed" ───────
//
// A Bedrock outage (2026-09-14/16/18) failed every review in the gate, and the
// grader reported each as a regression: `expected a summary comment, found
// none`. The check run said plainly that no verdict was produced. These drive
// the real script through a shim that serves the shapes GitHub actually
// returns — uppercase rollup, REST `{ total_count, check_runs }`, the literal
// Lambda summary — captured from run 35300428753's PRs.

const DEV = 'MergeWatch Review (dev)';
const PROD = 'MergeWatch Review';
const BEDROCK = 'MergeWatch encountered an error: Bedrock is unable to process your request.';
const TOO_LONG = 'MergeWatch encountered an error: Input is too long for requested model.';
const ABANDONED = 'Review abandoned — provider unavailable';
const sha = (c) => c.repeat(40);

let runId = 1000;
/** A REST check run. */
const checkRun = (name, conclusion, title, summary = '', status = 'completed') =>
  ({ id: runId++, name, status, conclusion, output: { title, summary } });
const reviewFailed = (name, summary = BEDROCK) => checkRun(name, 'failure', 'Review failed', summary);
const verdict = (name, conclusion = 'success', title = '4/5 — Generally safe') => checkRun(name, conclusion, title);

const devComment = (extra = '') =>
  `<!-- mergewatch-review:dev -->\n> 🟢 **4/5 — ok**\n\n| **Tokens** | 10 in · 1 out · 11 total |\n| **Est. cost** | ~$0.0100 (LLM only) |\n${extra}`;
const prodComment = () => '<!-- mergewatch-review -->\n> 🟢 **4/5 — ok**\n';

/**
 * One PR. `runs` maps commit sha -> REST check runs; the head's runs also feed
 * the rollup, uppercased as GraphQL reports them.
 */
function prSpec({ head = sha('h'), commits = [head], runs = {}, comments = [] } = {}) {
  const headRuns = runs[head] ?? [];
  return {
    headRefOid: head,
    state: 'OPEN',
    commits: commits.map((oid) => ({ oid })),
    comments: comments.map((body) => ({ body, author: { login: body.includes(':dev') ? 'mergewatch-ai-dev' : 'mergewatch' } })),
    reviews: [],
    reactionGroups: [],
    statusCheckRollup: headRuns.map((r) => ({
      __typename: 'CheckRun', name: r.name, status: String(r.status).toUpperCase(),
      conclusion: r.conclusion ? String(r.conclusion).toUpperCase() : null,
    })),
    runs,
  };
}

/** gh shim serving `pr view`, commit check-runs, and empty inline comments. */
function ghFull(prs) {
  const binDir = mkdtempSync(join(tmpdir(), 'gh-full-'));
  writeFileSync(join(binDir, 'gh'), `#!/usr/bin/env node
const prs = ${JSON.stringify(prs)};
const a = process.argv.slice(2);
if (a[0] === 'pr' && a[1] === 'view') {
  const p = prs[a[2]];
  if (!p) { process.stderr.write('no such PR'); process.exit(1); }
  const { runs, ...pr } = p;
  process.stdout.write(JSON.stringify(pr));
  process.exit(0);
}
const m = a[0] === 'api' && /commits\\/([0-9a-z]+)\\/check-runs/.exec(a[1] ?? '');
if (m) {
  const all = Object.values(prs).flatMap((p) => p.runs[m[1]] ?? []);
  process.stdout.write(JSON.stringify({ total_count: all.length, check_runs: all }));
  process.exit(0);
}
process.stdout.write('[]');
`);
  spawnSync('chmod', ['755', join(binDir, 'gh')]);
  return binDir;
}

/** A repo whose origin/main carries `expects` (raw strings are written verbatim). */
function repoWith(expects) {
  const dir = mkdtempSync(join(tmpdir(), 'grade-659-'));
  git(dir, 'init', '--quiet', '-b', 'main');
  git(dir, 'config', 'user.email', 'e2e@test');
  git(dir, 'config', 'user.name', 'e2e');
  for (const [name, e] of Object.entries(expects)) {
    write(dir, `fixtures/${name}/meta.env`, 'TAGS=correctness\n');
    write(dir, `fixtures/${name}/expect.json`, typeof e === 'string' ? e : JSON.stringify(e));
  }
  git(dir, 'add', '-A');
  git(dir, 'commit', '--quiet', '-m', 'expectations');
  const head = git(dir, 'rev-parse', 'HEAD');
  git(dir, 'update-ref', 'refs/remotes/origin/main', head);
  return { dir, head };
}

/** Grade `entries` ([fixture, pr|null]) against `expects` and `prs`, at the dev stage by default. */
function grade659(expects, prs, entries, ...args) {
  const { dir, head } = repoWith(expects);
  const bin = ghFull(prs);
  const mf = manifest(dir, 'run.json',
    entries.map(([fixture, pr]) => ({ fixture, pr, applied: 'ok' })), { snapshot: head });
  const stageArgs = args.includes('--compare') || args.includes('--stage') ? [] : ['--stage', 'dev'];
  return runWithGh(dir, bin, '--manifest', mf, ...stageArgs, ...args);
}

const bedrockBoth = (head = sha('h')) => ({ [head]: [reviewFailed(DEV), reviewFailed(PROD)] });
const gateBlock = (stdout) => {
  const lines = stdout.split('\n');
  const at = lines.findIndex((l) => l.startsWith('GATE:'));
  return at === -1 ? [] : lines.slice(at);
};

test('#659 — a Bedrock `Review failed` with no comment is ERROR, not a regression', () => {
  const r = grade659({ a: { comment: 'present' } }, { 1: prSpec({ runs: bedrockBoth() }) }, [['a', 1]]);
  assert.match(r.stdout, /! ERROR\s+a #1/);
  assert.match(r.stdout, /Bedrock is unable to process your request\./);
  assert.match(r.stdout, /^0 passed · 0 failed · 0 ungraded · 0 skipped · 1 errored$/m);
  assert.equal(r.status, 1);
});

test('#659 — the same with a comment is still ERROR, naming the head commit', () => {
  const r = grade659({ a: { comment: 'present' } },
    { 1: prSpec({ runs: bedrockBoth(), comments: [devComment()] }) }, [['a', 1]]);
  assert.match(r.stdout, /! ERROR\s+a #1/);
  assert.match(r.stdout, /provider error on hhhhhhh \(head\): "Bedrock is unable to process your request\."/);
});

test('#659 — evaluate() failures follow the error, marked possibly stale', () => {
  const r = grade659({ a: { comment: 'present', check: 'success' } },
    { 1: prSpec({ runs: bedrockBoth(), comments: [devComment()] }) }, [['a', 1]]);
  assert.match(r.stdout, /also \(may be stale\): check failure, expected success/);
});

test('#659 — an abandoned review is ERROR', () => {
  const r = grade659({ a: { comment: 'present' } },
    { 1: prSpec({ runs: { [sha('h')]: [checkRun(DEV, 'failure', ABANDONED, 'redrive cap'), reviewFailed(PROD)] } }) },
    [['a', 1]]);
  assert.match(r.stdout, /! ERROR\s+a #1/);
});

test('#659 — a shared PR whose earlier commit errored is ERROR, naming that commit', () => {
  // 18a is graded on 18b's head (run-suite.sh). Its own review is the earlier commit's.
  const first = sha('c');
  const head = sha('h');
  const r = grade659({ a: { comment: 'present' } }, {
    1: prSpec({
      head, commits: [first, head], comments: [devComment()],
      runs: { [first]: [reviewFailed(DEV), reviewFailed(PROD)], [head]: [verdict(DEV), verdict(PROD)] },
    }),
  }, [['a', 1]]);
  assert.match(r.stdout, /! ERROR\s+a #1/);
  assert.match(r.stdout, /provider error on ccccccc \(earlier commit on shared PR\)/);
});

test('#659 — a crash is a FAIL with the message, with or without a comment', () => {
  for (const comments of [[], [devComment()]]) {
    const r = grade659({ a: { comment: 'present' } },
      { 1: prSpec({ runs: { [sha('h')]: [reviewFailed(DEV, TOO_LONG), verdict(PROD)] }, comments }) }, [['a', 1]]);
    assert.match(r.stdout, /✗ FAIL\s+a #1/);
    assert.match(r.stdout, /review crashed on hhhhhhh: "Input is too long for requested model\."/);
  }
});

test('#659 (pin) — a critical verdict is a verdict, not a crash', () => {
  const r = grade659({ a: { comment: 'present', check: 'failure' } }, {
    1: prSpec({ runs: { [sha('h')]: [verdict(DEV, 'failure', '5/5 — 3 critical issues found'), verdict(PROD)] }, comments: [devComment()] }),
  }, [['a', 1]]);
  assert.match(r.stdout, /✓ PASS\s+a #1/);
  assert.doesNotMatch(r.stdout, /review crashed/);
});

const devOnly = () => prSpec({ runs: { [sha('h')]: [reviewFailed(DEV), verdict(PROD)] } });

test('#659 — a dev-only provider error says prod did not corroborate it', () => {
  const r = grade659({ a: { comment: 'present' } }, { 1: devOnly() }, [['a', 1]]);
  assert.match(r.stdout, /prod corroborated: no/);
});

test('#659 — a dev-only provider error says investigate, never "re-run"', () => {
  const r = grade659({ a: { comment: 'present' } }, { 1: devOnly() }, [['a', 1]]);
  assert.match(r.stdout, /Investigate the ERROR notes before re-running/);
  assert.doesNotMatch(r.stdout, /Re-run the gate once/);
  assert.match(r.stdout, /dev-only provider error: prod reviewed the same commit/);
});

test('#659 — a harness ERROR alongside a corroborated provider error says investigate', () => {
  const r = grade659({ a: '{ not json', b: { comment: 'present' } },
    { 2: prSpec({ runs: bedrockBoth() }) }, [['a', 1], ['b', 2]]);
  assert.match(r.stdout, /Investigate the ERROR notes before re-running/);
  assert.doesNotMatch(r.stdout, /Re-run the gate once/);
});

test('#659 — only corroborated provider errors say "re-run once"', () => {
  const r = grade659({ a: { comment: 'present' } }, { 1: prSpec({ runs: bedrockBoth() }) }, [['a', 1]]);
  assert.match(r.stdout, /^GATE: RED — 1 fixture\(s\) UNVERIFIED \(provider error, no verdict\); 0 regressions among the 0 that produced a verdict\. Re-run the gate once; do not bypass\.$/m);
});

test('#659 — a FAIL headline also counts provider and harness errors', () => {
  const r = grade659({ f: { comment: 'present' }, x: '{ not json', b: { comment: 'present' } }, {
    1: prSpec({ runs: { [sha('h')]: [verdict(DEV), verdict(PROD)] } }),
    3: prSpec({ head: sha('g'), runs: bedrockBoth(sha('g')) }),
  }, [['f', 1], ['x', 2], ['b', 3]]);
  assert.match(r.stdout, /^GATE: RED — 1 regression \(FAIL\), 1 UNVERIFIED \(provider error\), 1 ERROR \(harness\)$/m);
});

test('#659 — run 35300428753: each errored fixture, its PR and the message share a line in the tail', () => {
  // The 48 fixtures that run graded, in its order. 18b reuses 18a's PR, so it has none.
  const run = [
    ['01-clean-pr', 3550], ['02-info-only', 3551], ['03-critical-finding', 3552], ['04-auto-review-off', 3553],
    ['06-docs-only', 3554], ['07-include-patterns', 3555], ['09-draft-pr', 3556], ['10-skip-review-label', 3557],
    ['14-third-party-thread', 3558], ['15-mermaid-stress', 3559], ['16-agent-authored', 3560],
    ['17-grounding-hallucinated-anchor', 3561], ['18a-introduce-criticals', 3562], ['18b-fix-criticals', null],
    ['19-confidence-default-off', 3563], ['21-noop-suggestion', 3564], ['22-claim-aware-verify', 3565],
    ['23-convergence', 3566], ['24-triage-author-filter', 3567], ['25-w7-guardrail', 3568], ['26-call-site-snap', 3569],
    ['27-no-harness', 3570], ['28a-single-comment-approve', 3571], ['28b-single-comment-critical', 3572],
    ['29-cluster', 3573], ['30-confidence-floor', 3574], ['31-prev-disputed-prefilter', 3575],
    ['32-cross-agent-dedup', 3576], ['33-diagram-hallucinated-path', 3577], ['34-warning-verification', 3578],
    ['38-quiet-drop', 3579], ['49-re-review-no-anchoring', 3580], ['50-suggestion-redundant', 3581],
    ['51-no-self-contradiction', 3582], ['52-unverified-critical-render', 3583], ['75a-maxfiles-over', 3584],
    ['75b-maxfiles-boundary', 3585], ['76a-review-on-mention-off', 3586], ['76b-both-triggers-off', 3587],
    ['77a-exclude-generated', 3588], ['77b-exclude-all-changed', 3589], ['78a-output-shaping', 3590],
    ['78b-post-summary-on-clean', 3591], ['79-ux-block', 3592], ['80a-conventions-order', 3593],
    ['80b-conventions-cap', 3594], ['81-file-request-budget', 3595], ['98-oversized-diff-skip', 3596],
  ];
  assert.equal(run.length, 48);
  const errored = new Set(['14-third-party-thread', '15-mermaid-stress', '18a-introduce-criticals',
    '19-confidence-default-off', '23-convergence', '25-w7-guardrail']);
  const expects = Object.fromEntries(run.map(([f]) => [f, { comment: 'present' }]));
  const prs = {};
  for (const [f, n] of run) {
    if (n == null) continue;
    const h = n.toString(16).padStart(40, '0');
    prs[n] = errored.has(f)
      ? prSpec({ head: h, runs: bedrockBoth(h) })
      : prSpec({ head: h, runs: { [h]: [verdict(DEV), verdict(PROD)] }, comments: [devComment()] });
  }
  const r = grade659(expects, prs, run);
  assert.match(r.stdout, /^41 passed · 0 failed · 0 ungraded · 1 skipped · 6 errored$/m);
  const tail = r.stdout.trimEnd().split('\n').slice(-40);
  for (const [f, n] of run.filter(([f]) => errored.has(f))) {
    assert.ok(tail.some((l) => l.includes(f) && l.includes(`#${n}`) && l.includes('Bedrock is unable to process your request')),
      `${f} #${n} and the message share no line in the last 40:\n${tail.join('\n')}`);
  }
});

test('#659 — an all-errored run is not called a PARSER failure', () => {
  const r = grade659({ a: { comment: 'present' }, b: { comment: 'present' } },
    { 1: prSpec({ runs: bedrockBoth() }), 2: prSpec({ runs: bedrockBoth(sha('g')), head: sha('g') }) },
    [['a', 1], ['b', 2]]);
  assert.doesNotMatch(r.stdout, /PARSER failure/);
  assert.match(r.stdout, /2 fixture\(s\) have no verdict \(provider error \/ crashed\) — cost not measured: a, b/);
});

test('#659 — a crash with a cost block is listed as unmeasured, not totalled', () => {
  const r = grade659({ a: { comment: 'present' } },
    { 1: prSpec({ runs: { [sha('h')]: [reviewFailed(DEV, TOO_LONG), verdict(PROD)] }, comments: [devComment()] }) },
    [['a', 1]]);
  assert.match(r.stdout, /cost not measured: a/);
  assert.match(r.stdout, /Suite cost: ~\$0\.00 across 0 reviewed fixture\(s\)/);
});

test('#659 — --compare: a dev-only provider error is ERROR with a dev: note', () => {
  const r = grade659({ a: { comment: 'present' } },
    { 1: prSpec({ runs: { [sha('h')]: [reviewFailed(DEV), verdict(PROD)] }, comments: [prodComment()] }) },
    [['a', 1]], '--compare');
  assert.match(r.stdout, /! ERROR\s+a #1/);
  assert.match(r.stdout, /dev: provider error on hhhhhhh \(head\)/);
  assert.doesNotMatch(r.stdout, /no dev review comment found/);
});

test('#659 — a red run emits exactly one ::error annotation', () => {
  const r = grade659({ a: { comment: 'present' }, b: { comment: 'present' } },
    { 1: prSpec({ runs: bedrockBoth() }), 2: prSpec({ runs: { [sha('g')]: [verdict(DEV), verdict(PROD)] }, head: sha('g') }) },
    [['a', 1], ['b', 2]]);
  assert.equal(r.stderr.split('\n').filter((l) => l.startsWith('::error title=E2E gate::')).length, 1, r.stderr);
});

const green = () => grade659({ a: { comment: 'present' } },
  { 1: prSpec({ runs: { [sha('h')]: [verdict(DEV), verdict(PROD)] }, comments: [devComment()] }) }, [['a', 1]]);

test('#659 (pin) — a green run emits no ::error annotation', () => {
  const r = green();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(r.stderr, /::error/);
});

test('#659 — a green run ends with GATE: GREEN', () => {
  assert.match(green().stdout, /^GATE: GREEN$/m);
});

const redJson = () => grade659({ a: { comment: 'present' } }, { 1: prSpec({ runs: bedrockBoth() }) }, [['a', 1]], '--json');

test('#659 (pin) — a red --json run is still one parseable document', () => {
  assert.doesNotThrow(() => JSON.parse(redJson().stdout));
});

test('#659 — --json carries the gate and each result\'s noVerdict', () => {
  const r = redJson();
  const doc = JSON.parse(r.stdout);
  assert.equal(doc.gate.state, 'red');
  assert.equal(doc.results[0].noVerdict.kind, 'provider-transient');
  assert.equal(doc.results[0].noVerdict.commit, 'head');
  assert.match(r.stderr, /::error title=E2E gate::/);
});

test('#659 (pin) — the tally format is unchanged and is the only `passed ·` line', () => {
  const r = grade659({ a: { comment: 'present' } }, { 1: prSpec({ runs: bedrockBoth() }) }, [['a', 1]]);
  assert.match(r.stdout, /^\d+ passed · \d+ failed · \d+ ungraded · \d+ skipped · \d+ errored$/m);
  assert.equal(r.stdout.split('\n').filter((l) => l.includes('passed ·')).length, 1);
});

test('#659 — no GATE line says NOT VERIFIED', () => {
  // release-gate.yml greps `passed ·|NOT VERIFIED` into the release notes.
  const r = grade659({ a: { comment: 'present' } }, { 1: devOnly() }, [['a', 1]]);
  const block = gateBlock(r.stdout);
  assert.match(block[0] ?? '', /^GATE: /, 'no GATE block — the check below would pass vacuously');
  for (const l of block) assert.doesNotMatch(l, /NOT VERIFIED/);
});

test('#659 — nothing prints after the GATE block', () => {
  const r = grade659({ a: { comment: 'present' } }, { 1: devOnly() }, [['a', 1]]);
  const block = gateBlock(r.stdout).filter((l) => l !== '');
  assert.match(block[0], /^GATE: /);
  for (const l of block.slice(1)) assert.match(l, /^(  \d+ × |dev-only |prod-only )/, l);
});

test('#659 (pin) — a mismatched verdict is still FAIL, exit 1', () => {
  const r = grade659({ a: { comment: 'absent' } },
    { 1: prSpec({ runs: { [sha('h')]: [verdict(DEV), verdict(PROD)] }, comments: [devComment()] }) }, [['a', 1]]);
  assert.match(r.stdout, /✗ FAIL\s+a #1/);
  assert.equal(r.status, 1);
});

test('#659 (pin) — a harness-only ERROR still exits 1', () => {
  const r = grade659({ a: '{ not json', z: { comment: 'present' } }, {}, [['a', 1]]);
  assert.match(r.stdout, /! ERROR\s+a #1/);
  assert.equal(r.status, 1);
});

test('#659 — an unreadable check-run list is named on stderr, not swallowed', () => {
  const { dir, head } = repoWith({ a: { comment: 'present' } });
  const binDir = mkdtempSync(join(tmpdir(), 'gh-broken-'));
  writeFileSync(join(binDir, 'gh'), `#!/usr/bin/env node
const a = process.argv.slice(2);
if (a[0] === 'pr' && a[1] === 'view') {
  process.stdout.write(JSON.stringify({ headRefOid: '${'h'.repeat(40)}', state: 'OPEN', commits: [{ oid: '${'h'.repeat(40)}' }],
    comments: [], reviews: [], reactionGroups: [], statusCheckRollup: [] }));
  process.exit(0);
}
if (a[0] === 'api' && /check-runs/.test(a[1] ?? '')) { process.stderr.write('HTTP 502'); process.exit(1); }
process.stdout.write('[]');
`);
  spawnSync('chmod', ['755', join(binDir, 'gh')]);
  const mf = manifest(dir, 'run.json', [{ fixture: 'a', pr: 1, applied: 'ok' }], { snapshot: head });
  const r = runWithGh(dir, binDir, '--manifest', mf, '--stage', 'dev');
  assert.match(r.stderr, /note: could not read check runs for hhhhhhh/);
});

// ─── mergewatch.ai#660 — model-dependent failures say so ────────────────────

const MODEL = (variance) => ({ comment: 'present', _determinism: 'model', _variance: variance });
const twoModelFails = () => grade659(
  { m: MODEL('the model may or may not raise a finding here'), c: MODEL('a crash is not model variance at all') },
  {
    1: prSpec({ runs: { [sha('h')]: [verdict(DEV), verdict(PROD)] } }),
    2: prSpec({ head: sha('g'), runs: { [sha('g')]: [reviewFailed(DEV, TOO_LONG), verdict(PROD)] } }),
  },
  [['m', 1], ['c', 2]],
);

test('#660 — the count line excludes a crash: 1 of the 2 failures are model-dependent', () => {
  const r = twoModelFails();
  assert.match(r.stdout, /^1 of the 2 failures are model-dependent/m);
  const lines = r.stdout.split('\n');
  const tallyAt = lines.findIndex((l) => l.includes('passed ·'));
  assert.match(lines[tallyAt + 1], /^1 of the 2 failures are model-dependent/, 'not directly after the tally');
  assert.doesNotMatch(lines[tallyAt + 1], /passed ·|NOT VERIFIED/);
});

test('#660 — only the non-crash FAIL carries a model-dependent line, right after its notes', () => {
  const r = twoModelFails();
  const lines = r.stdout.split('\n');
  const annotation = (l) => /^\s+model-dependent: /.test(l);
  assert.equal(lines.filter(annotation).length, 1, r.stdout);
  const at = lines.findIndex(annotation);
  const owner = lines.slice(0, at).reverse().find((l) => /^[✓✗!⊘·] /.test(l));
  assert.match(owner, /✗ FAIL\s+m #1/);
  assert.match(lines[at], /model-dependent: the model may or may not raise a finding here/);
});

test('#660 (pin) — a mechanical FAIL is not annotated', () => {
  const r = grade659({ a: { comment: 'present', _determinism: 'mechanical' } },
    { 1: prSpec({ runs: { [sha('h')]: [verdict(DEV), verdict(PROD)] } }) }, [['a', 1]]);
  assert.match(r.stdout, /✗ FAIL\s+a #1/);
  assert.doesNotMatch(r.stdout, /model-dependent/);
});

test('#660 (pin) — --json output carries no labels', () => {
  const r = grade659({ m: MODEL('the model may or may not raise a finding here') },
    { 1: prSpec({ runs: { [sha('h')]: [verdict(DEV), verdict(PROD)] } }) }, [['m', 1]], '--json');
  const doc = JSON.parse(r.stdout);
  assert.equal(doc.results[0].determinism, undefined);
  assert.equal(doc.results[0].variance, undefined);
});
