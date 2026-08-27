/**
 * Is a fixture PR still there to be waited on? (mergewatch.ai#506)
 *
 * This repo is a single shared mutable resource. `reset-env.sh` closes every
 * open `fixture/*` PR and deletes its branch, and it is not scoped to the run
 * that called it — a runner has no way to tell its own fixture branches from
 * another run's. So a second suite starting mid-flight silently destroys the
 * first one's PRs.
 *
 * What the victim used to do about it: nothing. `await-reviews.mjs` polled for
 * check runs on PRs that no longer existed, burned its entire timeout, and
 * reported `absent` for every one of them — which reads as "webhooks are
 * broken" or "the review agent is down". The actual cause left no trace
 * anywhere in the log.
 *
 * A PR this run opened seconds ago has no legitimate reason to be closed, so
 * a closed one is evidence, not noise. These helpers turn a `gh pr view`
 * payload into that judgement. They are pure so the decision can be tested
 * without a network, which the polling loop around them cannot be.
 */

/** Check-run status when the API call itself failed — never a verdict. */
export const UNKNOWN = null;

/**
 * State of the named check on a PR: absent | queued | in_progress | completed.
 *
 * `absent` means no check run of that name exists yet. MergeWatch opens the
 * check when it picks the PR up, so absent is "the webhook has not been
 * handled" — which is a real answer, distinct from queued.
 */
export function checkStateFrom(rollup, checkName) {
  const runs = (rollup ?? []).filter((c) => c && c.name === checkName);
  if (!runs.length) return 'absent';
  const status = (runs[runs.length - 1].status ?? '').toLowerCase();
  return status === 'completed' ? 'completed' : (status || 'queued');
}

/**
 * true = open, false = gone, null = cannot tell.
 *
 * Null is not a soft "no". An unrecognised or missing state means an older
 * `gh`, a changed schema, or a payload we did not understand — and aborting a
 * run on that would replace a slow honest failure with a fast wrong one. Only
 * an explicit CLOSED or MERGED counts as gone.
 */
export function isLive(state) {
  if (typeof state !== 'string') return UNKNOWN;
  switch (state.toUpperCase()) {
    case 'OPEN':
      return true;
    case 'CLOSED':
    case 'MERGED':
      // MERGED is not something the suite does either. Both mean this PR is no
      // longer the thing we opened and are waiting on.
      return false;
    default:
      return UNKNOWN;
  }
}

/**
 * The entries whose PR is definitively gone. Entries we could not classify are
 * left alone: the caller keeps waiting on them, and the timeout stays the
 * backstop it always was.
 */
export function tornDown(entries) {
  return (entries ?? []).filter((e) => e && e.live === false);
}

/**
 * Explain the teardown, in the terms someone reading a failed run needs.
 *
 * The point is to name the cause. "Timed out waiting for reviews" sends the
 * reader to the review agent's logs, where they will find nothing, because
 * nothing was wrong with it.
 */
export function tornDownReport(gone) {
  const lines = [
    `::error::${gone.length} fixture PR(s) were closed while this run was waiting for them.`,
    'Something else reset this repo mid-run. `reset-env.sh` closes every open',
    'fixture/* PR and is not scoped to its own run, so a second suite starting',
    'while this one was in flight tears down its PRs.',
    '',
  ];
  for (const g of gone) {
    lines.push(`  ✗ ${g.fixture} #${g.pr}: gone (check was "${g.state}")`);
  }
  lines.push(
    '',
    'This run proved nothing about the product — do not read it as a regression.',
    'In CI the e2e-fixtures concurrency group prevents this; a local suite run',
    'overlapping a gate run is the usual cause. Check for one before re-running:',
    '  gh run list --repo mergewatch/mergewatch.ai --workflow=deploy.yml --status in_progress',
  );
  return lines;
}
