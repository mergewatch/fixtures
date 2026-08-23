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
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

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

/** Current state of this PR's stage check: absent | queued | in_progress | completed. */
function checkState(repo, pr) {
  let rollup;
  try {
    rollup = JSON.parse(gh(['pr', 'view', String(pr), '--repo', repo, '--json', 'statusCheckRollup']))
      .statusCheckRollup ?? [];
  } catch {
    // A transient API failure is not evidence about the review. Report it as
    // "absent" so the loop keeps waiting rather than declaring a false verdict.
    return 'absent';
  }
  const runs = rollup.filter((c) => c.name === checkName);
  if (!runs.length) return 'absent';
  const status = (runs[runs.length - 1].status ?? '').toLowerCase();
  return status === 'completed' ? 'completed' : (status || 'queued');
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

// Fixtures with no PR (manual, reuse, or failed to apply) have nothing to wait
// for. Excluding them here keeps a failed apply from stalling the whole wait.
const targets = (manifest.fixtures ?? []).filter((f) => f.pr != null);
if (!targets.length) {
  console.log('No fixture PRs to wait for.');
  process.exit(0);
}

console.log(`Waiting for ${targets.length} review(s) — check "${checkName}", timeout ${TIMEOUT_S}s.`);

const deadline = Date.now() + TIMEOUT_S * 1000;
let states = new Map();

while (Date.now() < deadline) {
  states = new Map(targets.map((f) => [f.fixture, { pr: f.pr, state: checkState(repo, f.pr) }]));
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
process.exit(1);
