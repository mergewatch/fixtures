#!/usr/bin/env node
/**
 * Wait for every fixture PR in a run manifest to finish being reviewed.
 *
 *   scripts/await-reviews.mjs [--manifest .e2e/last-run.json] [--stage dev]
 *                             [--timeout 900] [--interval 15]
 *
 * Replaces the fixed sleep that used to sit between running the suite and
 * grading it. A timer cannot answer the question that matters: it treats a
 * review that is still working and a review that never started as the same
 * thing, and grading either one early reports a missing comment as a product
 * failure.
 *
 * The stage's check run answers it directly. MergeWatch opens the check when
 * it picks the PR up and completes it when the verdict is posted, so:
 *
 *   absent      -> the webhook has not been handled yet (or never will be)
 *   queued      -> accepted, not started
 *   in_progress -> running
 *   completed   -> ready to grade
 *
 * Exits 0 once every PR is completed, 1 on timeout — and on timeout it prints
 * each PR's actual state, because "3 stuck at queued" and "3 never got a check
 * run" have completely different causes: the first is a slow or dead-lettered
 * queue, the second means webhooks are not arriving at all.
 *
 * Exits 2 if the PRs are torn down underneath it (mergewatch.ai#506). That is
 * a third cause with a third fix, and it used to be indistinguishable from the
 * second: a concurrent run's reset-env.sh closes these PRs, every poll after
 * that reports `absent`, and the run burns its full timeout before blaming
 * webhooks that were working fine. See scripts/pr-liveness.mjs.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { checkStateFrom, isLive, tornDown, tornDownReport } from './pr-liveness.mjs';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};

const MANIFEST = flag('--manifest', '.e2e/last-run.json');
const STAGE = flag('--stage', '');
const TIMEOUT_S = Number(flag('--timeout', '900'));
const INTERVAL_S = Number(flag('--interval', '15'));

const checkName = !STAGE || STAGE === 'prod'
  ? 'MergeWatch Review'
  : `MergeWatch Review (${STAGE})`;

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

/**
 * This PR's stage-check state plus whether the PR is still open.
 *
 * Both come out of ONE `gh pr view`: liveness is a field on the same payload,
 * so detecting teardown costs no extra API calls in the poll loop.
 */
function prStatus(repo, pr) {
  let view;
  try {
    view = JSON.parse(gh(['pr', 'view', String(pr), '--repo', repo, '--json', 'state,statusCheckRollup']));
  } catch {
    // A transient API failure is not evidence about the review, and it is not
    // evidence the PR is gone either. Report "absent" plus unknown liveness so
    // the loop keeps waiting rather than declaring a false verdict either way.
    return { state: 'absent', live: null };
  }
  return {
    state: checkStateFrom(view.statusCheckRollup, checkName),
    live: isLive(view.state),
  };
}

const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

if (!existsSync(MANIFEST)) {
  console.error(`No manifest at ${MANIFEST}. Run scripts/run-suite.sh first.`);
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const repo = manifest.repo && manifest.repo !== 'unknown'
  ? manifest.repo
  : gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']).trim();

/**
 * A fixture whose `expect.json` says `check: "none"` will NEVER get a check
 * run — that is the assertion. E2E-04 (`autoReview: false`) and E2E-76b (both
 * triggers off) are silent skips: zero PR trace, by design.
 *
 * Polling for a check that cannot appear burns the whole timeout and then
 * reports it `absent`, which reads as "webhooks are broken". The first
 * full-coverage gate run hit exactly this — every earlier run happened to
 * select only fixtures that do produce a check.
 */
function expectsNoCheck(fixture) {
  try {
    return JSON.parse(readFileSync(`fixtures/${fixture}/expect.json`, 'utf8')).check === 'none';
  } catch {
    return false; // no expectation recorded — wait, and let the timeout report it
  }
}

// Fixtures with no PR (manual, reuse, or failed to apply) have nothing to wait
// for. Excluding them here keeps a failed apply from stalling the whole wait.
const withPr = (manifest.fixtures ?? []).filter((f) => f.pr != null);
const checkless = withPr.filter((f) => expectsNoCheck(f.fixture));
const targets = withPr.filter((f) => !expectsNoCheck(f.fixture));
if (checkless.length) {
  console.log(`Not waiting on ${checkless.length} silent-skip fixture(s) — they assert `
    + `NO check run: ${checkless.map((f) => f.fixture).join(', ')}`);
}
if (!targets.length) {
  console.log('No fixture PRs to wait for.');
  process.exit(0);
}

console.log(`Waiting for ${targets.length} review(s) — check "${checkName}", timeout ${TIMEOUT_S}s.`);

const deadline = Date.now() + TIMEOUT_S * 1000;
let states = new Map();

while (Date.now() < deadline) {
  states = new Map(targets.map((f) => [f.fixture, { fixture: f.fixture, pr: f.pr, ...prStatus(repo, f.pr) }]));

  // Before deciding anything about the reviews: are the PRs still there? A PR
  // this run opened has no legitimate reason to close, so even one is enough.
  // Fail here rather than waiting out the timeout — every remaining poll would
  // just accumulate more evidence for the wrong conclusion.
  const gone = tornDown([...states.values()]);
  if (gone.length) {
    for (const line of tornDownReport(gone)) console.error(line);
    process.exit(2);
  }

  const pending = [...states.values()].filter((s) => s.state !== 'completed');
  if (!pending.length) {
    console.log(`All ${targets.length} review(s) completed.`);
    process.exit(0);
  }
  const left = Math.round((deadline - Date.now()) / 1000);
  console.log(`  ${targets.length - pending.length}/${targets.length} complete · `
    + `${pending.map((p) => `#${p.pr}:${p.state}`).join(' ')} · ${left}s left`);
  await sleep(INTERVAL_S);
}

console.error(`::error::Timed out after ${TIMEOUT_S}s waiting for reviews.`);
for (const [fixture, s] of states) {
  console.error(`  ${s.state === 'completed' ? '✓' : '✗'} ${fixture} #${s.pr}: ${s.state}`);
}
console.error('absent = no check run at all (webhook never handled it);'
  + ' queued/in_progress = accepted but not finished (slow or dead-lettered queue).');
console.error('If everything is `absent`, also check nothing else was driving this repo:'
  + ' a concurrent run resets it and the PRs would show CLOSED (mergewatch.ai#506).');
process.exit(1);
