import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classify, pickRun, corroboration, escapeAnnotation, formatGate, oneLine,
  ABANDONED_TITLE, REVIEW_FAILED_TITLE, ERROR_PREFIX,
} from './no-verdict.mjs';

/**
 * mergewatch.ai#659 — the rules that decide "errored" vs "disagreed", without
 * the grader around them. grade-run.test.mjs drives them end to end through a
 * gh shim; these pin each rule on its own so a regression names itself.
 */
const failed = (summary, extra = {}) => ({
  id: 1, name: 'MergeWatch Review (dev)', status: 'completed', conclusion: 'failure',
  output: { title: REVIEW_FAILED_TITLE, summary }, ...extra,
});
const BEDROCK = `${ERROR_PREFIX}Bedrock is unable to process your request.`;

test('status and conclusion match case-insensitively (rollup is upper, REST lower)', () => {
  const upper = failed(BEDROCK, { status: 'COMPLETED', conclusion: 'FAILURE' });
  assert.deepEqual(classify(upper), {
    kind: 'provider-transient', message: 'Bedrock is unable to process your request.',
  });
  // Still running, or a verdict: not a no-verdict result.
  assert.equal(classify(failed(BEDROCK, { status: 'in_progress', conclusion: null })), null);
  assert.equal(classify(failed(BEDROCK, { conclusion: 'success' })), null);
});

test('a verdict titled with its score is never a no-verdict, even when it fails', () => {
  const verdict = failed('3 critical issues', { output: { title: '5/5 — 3 critical issues found', summary: '' } });
  assert.equal(classify(verdict), null);
});

test('pickRun takes the highest id, not list position', () => {
  const runs = [
    { id: 30, name: 'MergeWatch Review (dev)' },
    { id: 99, name: 'MergeWatch Review' },
    { id: 41, name: 'MergeWatch Review (dev)' },
    { id: 7, name: 'MergeWatch Review (dev)' },
  ];
  assert.equal(pickRun(runs, 'MergeWatch Review (dev)').id, 41);
  assert.equal(pickRun(runs, 'absent'), null);
});

test('the transient allowlist is a case-insensitive substring match', () => {
  assert.equal(classify(failed(`${ERROR_PREFIX}ServiceUnavailable: BEDROCK IS UNABLE TO PROCESS YOUR REQUEST (retry)`)).kind,
    'provider-transient');
  // Anything not on the list is a crash, which is a FAIL: guessing here hides regressions.
  assert.deepEqual(classify(failed(`${ERROR_PREFIX}Input is too long for requested model.`)), {
    kind: 'review-crashed', message: 'Input is too long for requested model.',
  });
});

test('an abandoned review is a provider error', () => {
  const r = failed('DLQ redrive cap reached', { output: { title: ABANDONED_TITLE, summary: 'DLQ redrive cap reached' } });
  assert.equal(classify(r).kind, 'provider-transient');
});

test('a multi-line message with % becomes one escaped annotation line', () => {
  const msg = oneLine('100% of\nrequests\r\nfailed');
  assert.equal(msg, '100% of requests failed');
  assert.equal(escapeAnnotation('100% of\nrequests\r\nfailed'), '100%25 of%0Arequests%0D%0Afailed');
  assert.equal(escapeAnnotation('x'.repeat(500)).length, 300);
});

test('corroboration: shared outage, dev-only, and nothing to compare', () => {
  assert.equal(corroboration(failed(BEDROCK)), 'yes');
  assert.equal(corroboration({ status: 'completed', conclusion: 'success', output: { title: '4/5 — ok' } }), 'no');
  assert.equal(corroboration(failed(`${ERROR_PREFIX}TypeError: x is undefined`)), 'no');
  assert.equal(corroboration(null), 'unknown');
  assert.equal(corroboration({ status: 'in_progress' }), 'unknown');
});

test('formatGate never says "not a regression", in any state', () => {
  const nv = (corroborated) => ({ kind: 'provider-transient', message: 'Bedrock down', sha: 'a'.repeat(40), commit: 'head', corroborated });
  const shapes = [
    [],
    [{ fixture: 'a', pr: 1, verdict: 'PASS', notes: [] }],
    [{ fixture: 'a', pr: 1, verdict: 'ERROR', notes: ['x'], noVerdict: nv('yes') }],
    [{ fixture: 'a', pr: 1, verdict: 'ERROR', notes: ['x'], noVerdict: nv('no') }],
    [{ fixture: 'a', pr: 1, verdict: 'ERROR', notes: ['bad json'], noVerdict: null }],
    [{ fixture: 'a', pr: 1, verdict: 'FAIL', notes: ['score 5 above max 2'] },
      { fixture: 'b', pr: 2, verdict: 'ERROR', notes: ['x'], noVerdict: nv('yes') }],
  ];
  for (const rs of shapes) {
    for (const stage of ['dev', 'prod']) {
      const g = formatGate(rs, { stage });
      for (const line of g.lines) assert.doesNotMatch(line, /not a regression/i, line);
    }
  }
});
