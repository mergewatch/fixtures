/**
 * mergewatch.ai#659 — telling "the review errored" apart from "the review
 * disagreed".
 *
 * Both used to grade FAIL. On 2026-09-14/16/18 a Bedrock outage failed every
 * review in the gate: no comment, check `failure`, and the grader reported each
 * as `expected a summary comment, found none` — a regression, blocking prod,
 * for code nobody had looked at. A reader had to open check runs one by one to
 * learn the model never answered.
 *
 * The check run already says which it is. A review that produced a verdict
 * titles its check with the score; one that never produced one titles it
 * `Review failed` (the Lambda catch) or `Review abandoned — provider
 * unavailable` (DLQ redrive), and puts the error in the summary. This module
 * reads that, and nothing else. It is pure so the rules can be tested without
 * the grader, which runs its main body on import.
 *
 * Two outcomes, deliberately asymmetric:
 *   - provider-transient → ERROR (UNVERIFIED): the provider failed, so there is
 *     no verdict to grade. Allowlisted by message, because a guess here hides
 *     regressions.
 *   - review-crashed → FAIL: any other `Review failed`. A crash while dev runs
 *     the change under test is a regression until proven otherwise (E2E-98
 *     exists to FAIL if #423 returns).
 */

/** Prefix the Lambda catch puts before the error message in the check summary. */
export const ERROR_PREFIX = 'MergeWatch encountered an error: ';

/** Check title for a review that threw (mergewatch.ai review-agent.ts catch). */
export const REVIEW_FAILED_TITLE = 'Review failed';

/**
 * Check title for a review abandoned after the DLQ redrive cap. A copy of the
 * literal at mergewatch.ai `packages/lambda/src/handlers/dlq-redrive.ts:91`;
 * nothing exports it, and this repo cannot import from that one.
 */
export const ABANDONED_TITLE = 'Review abandoned — provider unavailable';

/**
 * Error messages that mean the PROVIDER failed, matched as case-insensitive
 * substrings. Deliberately short: every Sep 14-18 failure was this one message.
 * Widening it turns crashes into excused errors, so each addition needs a
 * captured example, not a guess.
 */
export const TRANSIENT_MESSAGES = ['Bedrock is unable to process your request'];

const MAX = 300;

/** Collapse any whitespace run, newlines included, to one space. */
export function oneLine(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

/** Clip to `MAX` characters, marking the cut. */
export function clip(s, max = MAX) {
  const t = String(s ?? '');
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * The newest run with this name. Highest `id`, not list position: the REST
 * endpoint does not promise an order, and a re-run appends a new run.
 */
export function pickRun(runs, name) {
  let best = null;
  for (const r of runs ?? []) {
    if (r?.name !== name) continue;
    if (!best || Number(r.id) > Number(best.id)) best = r;
  }
  return best;
}

const lower = (v) => String(v ?? '').toLowerCase();
const titleOf = (run) => run?.output?.title ?? run?.title ?? null;
const summaryOf = (run) => run?.output?.summary ?? run?.summary ?? null;

/**
 * Did this check run end without a verdict? `null` means it did not: it
 * produced one (any score, any conclusion), is still running, or is absent.
 *
 * Matching is exact on the title and case-insensitive on status/conclusion,
 * because the rollup reports `COMPLETED`/`FAILURE` and REST `completed`/`failure`.
 */
export function classify(run) {
  if (!run) return null;
  if (lower(run.status) !== 'completed' || lower(run.conclusion) !== 'failure') return null;
  const title = titleOf(run);
  if (title !== REVIEW_FAILED_TITLE && title !== ABANDONED_TITLE) return null;

  const summary = oneLine(summaryOf(run));
  const message = summary.startsWith(ERROR_PREFIX) ? summary.slice(ERROR_PREFIX.length) : summary;
  if (title === ABANDONED_TITLE) {
    return { kind: 'provider-transient', message: message || ABANDONED_TITLE };
  }
  const m = message.toLowerCase();
  const transient = TRANSIENT_MESSAGES.some((t) => m.includes(t.toLowerCase()));
  return { kind: transient ? 'provider-transient' : 'review-crashed', message };
}

/**
 * Did the OTHER stage's review of the same commit hit the same provider error?
 *
 * `yes` — it did, so the outage was shared and the change is not implicated.
 * `no` — it finished some other way (a verdict, or a crash): dev-only, so the
 *        change under test may be the cause.
 * `unknown` — no completed run to compare against.
 */
export function corroboration(otherRun) {
  const c = classify(otherRun);
  if (c?.kind === 'provider-transient') return 'yes';
  if (otherRun && lower(otherRun.status) === 'completed') return 'no';
  return 'unknown';
}

/** Escape for a GitHub Actions `::error::` annotation, on one line. */
export function escapeAnnotation(s) {
  return clip(String(s ?? '')
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A'));
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * The GATE block: one headline a reader can act on, then one line per distinct
 * cause. Printed last so the job summary's `tail -40` carries it.
 *
 * It never says "not a regression". An ERROR is UNVERIFIED — the review never
 * happened — which is a different claim, and the one the evidence supports.
 *
 * @param results grader results: `{ fixture, pr, verdict, notes, noVerdict }`
 * @param opts.stage the graded stage (`dev` or `prod`); corroboration reads the other
 */
export function formatGate(results, { stage } = {}) {
  const other = stage === 'prod' ? 'dev' : 'prod';
  const fails = results.filter((r) => r.verdict === 'FAIL');
  const provider = results.filter((r) => r.verdict === 'ERROR' && r.noVerdict);
  const harness = results.filter((r) => r.verdict === 'ERROR' && !r.noVerdict);
  const verdicts = results.filter((r) => r.verdict === 'PASS' || r.verdict === 'FAIL').length;
  const P = provider.length;
  const H = harness.length;
  const M = P + H;

  const lines = [];
  let state = 'green';
  let headline = 'GATE: GREEN';
  if (fails.length) {
    state = 'red';
    headline = `GATE: RED — ${plural(fails.length, 'regression', 'regressions')} (FAIL)`
      + (P ? `, ${P} UNVERIFIED (provider error)` : '')
      + (H ? `, ${H} ERROR (harness)` : '');
  } else if (M) {
    state = 'red';
    const allCorroborated = H === 0 && provider.every((r) => r.noVerdict.corroborated === 'yes');
    headline = allCorroborated
      ? `GATE: RED — ${M} fixture(s) UNVERIFIED (provider error, no verdict); 0 regressions among the ${verdicts} that produced a verdict. Re-run the gate once; do not bypass.`
      : `GATE: RED — ${M} fixture(s) ERROR (no verdict); 0 regressions among the ${verdicts} that produced a verdict. Investigate the ERROR notes before re-running.`;
  }
  lines.push(headline);
  if (provider.some((r) => r.noVerdict.corroborated === 'no')) {
    lines.push(`${stage === 'prod' ? 'prod' : 'dev'}-only provider error: ${other} reviewed the same commit, so this change may be the cause`);
  }

  // One line per distinct (kind, message), so the cause and every fixture it
  // hit share a line and survive the job summary's tail.
  const groups = new Map();
  const add = (kind, message, r, corr) => {
    const key = `${kind}\u0000${message}`;
    if (!groups.has(key)) groups.set(key, { kind, message, rows: [], corr: new Set() });
    const g = groups.get(key);
    g.rows.push(r);
    if (corr) g.corr.add(corr);
  };
  for (const r of fails) {
    if (r.noVerdict?.kind === 'review-crashed') add('review-crashed', r.noVerdict.message, r);
    else add('regression', oneLine((r.notes ?? []).find((n) => !/^also \(may be stale\)/.test(n)) ?? ''), r);
  }
  for (const r of provider) add('provider-transient', r.noVerdict.message, r, r.noVerdict.corroborated);
  for (const r of harness) add('harness', oneLine((r.notes ?? [])[0] ?? ''), r);

  for (const g of groups.values()) {
    let corr = '';
    if (g.kind === 'provider-transient') {
      const vals = [...g.corr];
      corr = vals.length === 1 && vals[0] === 'yes'
        ? ` (${other} corroborated)`
        : ` (${other} corroborated: ${vals.length === 1 ? vals[0] : 'mixed'})`;
    }
    const who = g.rows.map((r) => `${r.fixture}${r.pr == null ? '' : ` #${r.pr}`}`).join(', ');
    lines.push(`  ${g.rows.length} × ${g.kind} ${JSON.stringify(clip(g.message))}${corr}: ${who}`);
  }
  return { state, headline, lines };
}
