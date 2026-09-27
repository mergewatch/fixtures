import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Structural checks on `expect.json`, run with no network and no LLM spend.
 *
 * These exist because fixtures#1076 wrote 27 expectations in one pass and three
 * of them were unsatisfiable — not wrong about the product, but unable to test
 * the thing they named. The first full gate run after that found them, at the
 * cost of a blocked deploy and a 45-minute suite.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = join(ROOT, 'fixtures');

/**
 * Fixtures allowed to assert that an in-overlay string is absent from the
 * comment. Deliberately empty.
 *
 * There IS a legitimate shape here — "this secret is in the diff and must be
 * redacted from the output" — so this is an allowlist rather than a ban. But
 * adding to it should be a decision with a reason attached, not a default.
 */
const IN_DIFF_ABSENCE_ALLOWED = new Map([
  // 'NN-fixture-name': 'why the absence is a real contract here',
]);

const fixtureDirs = readdirSync(FIXTURES).filter((n) => {
  const d = join(FIXTURES, n);
  return statSync(d).isDirectory() && existsSync(join(d, 'expect.json'));
});

/** Every file under a fixture's overlay, as one blob. */
function overlayText(name) {
  const dir = join(FIXTURES, name, 'overlay');
  if (!existsSync(dir)) return '';
  const out = [];
  const walk = (p) => {
    for (const entry of readdirSync(p)) {
      const full = join(p, entry);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(readFileSync(full, 'utf8'));
    }
  };
  walk(dir);
  return out.join('\n');
}

test('the fixture set is non-empty — otherwise every check below is vacuous', () => {
  assert.ok(fixtureDirs.length > 20, `only ${fixtureDirs.length} graded fixtures found`);
});

test('every expect.json parses', () => {
  for (const name of fixtureDirs) {
    const raw = readFileSync(join(FIXTURES, name, 'expect.json'), 'utf8');
    assert.doesNotThrow(() => JSON.parse(raw), `${name}/expect.json is not valid JSON`);
  }
});

test('no mustNotContain asserts the absence of a string the diff contains', () => {
  // The failure this catches: a string present in the overlay is present in the
  // diff, so a finding, the diagram, or cited-code evidence (#469) can quote it
  // at any time — through a path that has nothing to do with the mechanism
  // under test. 79-ux-block asserted an XSS payload was absent while the
  // security agent was correctly flagging that very payload; 80b asserted
  // LATE-RULE was absent while the diagram named it straight from the diff.
  //
  // Such an assertion does not test the feature. It tests whether the reviewer
  // stayed quiet, and it fails the moment the reviewer does its job.
  const offenders = [];
  for (const name of fixtureDirs) {
    const expect = JSON.parse(readFileSync(join(FIXTURES, name, 'expect.json'), 'utf8'));
    const text = overlayText(name);
    if (!text) continue;
    for (const needle of expect.mustNotContain ?? []) {
      if (text.includes(needle) && !IN_DIFF_ABSENCE_ALLOWED.has(name)) {
        offenders.push(`${name}: ${JSON.stringify(needle)} is in its own overlay`);
      }
    }
  }
  assert.deepEqual(offenders, [], `\n${offenders.join('\n')}\n\n`
    + 'Assert the mechanism directly instead — the review-details row, the escaped\n'
    + 'form, a check conclusion. If the absence really is the contract (a secret\n'
    + 'that must be redacted), add the fixture to IN_DIFF_ABSENCE_ALLOWED with a\n'
    + 'reason.');
});

test('mustContain and mustNotContain never assert the same string', () => {
  for (const name of fixtureDirs) {
    const e = JSON.parse(readFileSync(join(FIXTURES, name, 'expect.json'), 'utf8'));
    const both = (e.mustContain ?? []).filter((s) => (e.mustNotContain ?? []).includes(s));
    assert.deepEqual(both, [], `${name} both requires and forbids ${JSON.stringify(both)}`);
  }
});

test('every expect.json carries a _source explaining what it asserts', () => {
  // The reasoning is the reviewable part. An assertion with no stated contract
  // is impossible to triage when it fails — which is the position all three
  // fixtures above put us in.
  const missing = fixtureDirs.filter((name) => {
    const e = JSON.parse(readFileSync(join(FIXTURES, name, 'expect.json'), 'utf8'));
    return typeof e._source !== 'string' || e._source.trim().length < 20;
  });
  assert.deepEqual(missing, []);
});

// ─── mergewatch.ai#660 — every expectation says how deterministic it is ───────
//
// `correctness` means a product contract gated at release, not that the outcome
// is deterministic. ≥28 of 54 fixtures depend on what the model happens to
// find, and a red gate on one of them read exactly like a regression until
// someone opened check runs to find out. The label makes that visible:
//
//   skip        decided before any LLM call (no comment, no review, no check /
//               a neutral skip check)
//   mechanical  holds for ANY output of a completed review; `_source` cites the
//               symbol that guarantees it
//   model       holds for some model outputs only; `_variance` says which
//
// The rules below force `model` wherever an assertion reads model output, so a
// label cannot understate the variance. `mechanical` is the only label an
// author has to argue for.

const LABELS = new Set(['skip', 'mechanical', 'model']);

/** No comment, no review, and no check (or a neutral skip check). */
export function skipShaped(e) {
  if (e.comment !== 'absent' || e.reviewState !== 'none') return false;
  if (e.check === 'none') return true;
  return e.check === 'neutral' && /skip/i.test(e.checkTitleMatches ?? '');
}

/** Does any assertion read something only the model decides? */
export function readsModelOutput(e) {
  const fullRange = e.score && typeof e.score === 'object'
    && e.score.min === 1 && e.score.max === 5 && e.score.is == null;
  return e.comment === 'absent'
    || e.findings != null
    || e.inlineComments != null
    || (e.score != null && !fullRange)
    || e.check === 'success' || e.check === 'failure'
    || e.reviewState === 'APPROVED' || e.reviewState === 'CHANGES_REQUESTED'
    || e.findingLines != null;
}

export const OVERLAY_78B = [/^minSeverity:\s*critical\s*$/m, /^postSummaryOnClean:\s*false\s*$/m];

/** Every labelling violation across `fixtures` ([{ name, expect, overlayYaml }]). */
export function labelViolations(fixtures) {
  const out = [];
  for (const { name, expect: e, overlayYaml } of fixtures) {
    // Independent of the label, so a missing label cannot hide it.
    if (name === '78b-post-summary-on-clean') {
      for (const re of OVERLAY_78B) {
        if (!re.test(overlayYaml ?? '')) out.push(`${name}: overlay .mergewatch.yml must match ${re}`);
      }
    }
    const label = e._determinism;
    if (!LABELS.has(label)) {
      out.push(`${name}: _determinism is ${JSON.stringify(label)}, expected skip | mechanical | model`);
      continue;
    }
    if ((label === 'skip') !== skipShaped(e)) {
      out.push(`${name}: labelled ${label} but ${skipShaped(e) ? 'is' : 'is not'} skip-shaped`);
    }
    if (!skipShaped(e) && readsModelOutput(e) && label !== 'model') {
      out.push(`${name}: asserts model output but is labelled ${label}`);
    }
    if (label === 'model' && (typeof e._variance !== 'string' || e._variance.trim().length < 20)) {
      out.push(`${name}: model fixture needs a _variance of 20+ characters`);
    }
  }
  return out;
}

const realFixtures = () => fixtureDirs.map((name) => {
  const yml = join(FIXTURES, name, 'overlay', '.mergewatch.yml');
  return {
    name,
    expect: JSON.parse(readFileSync(join(FIXTURES, name, 'expect.json'), 'utf8')),
    overlayYaml: existsSync(yml) ? readFileSync(yml, 'utf8') : null,
  };
});

test('#660 — every expect.json is labelled, and the label matches what it asserts', () => {
  const v = labelViolations(realFixtures());
  assert.deepEqual(v, [], `\n${v.join('\n')}\n`);
});

test('#660 — the rules catch each mislabel (mutations of the real set)', () => {
  const base = realFixtures();
  const mutate = (name, fn) => base.map((f) => (f.name === name ? fn(structuredClone(f)) : f));
  const cases = {
    '78b labelled skip': mutate('78b-post-summary-on-clean', (f) => { f.expect._determinism = 'skip'; return f; }),
    '04 labelled mechanical': mutate('04-auto-review-off', (f) => { f.expect._determinism = 'mechanical'; return f; }),
    '01 labelled mechanical': mutate('01-clean-pr', (f) => { f.expect._determinism = 'mechanical'; return f; }),
    '78b without _variance': mutate('78b-post-summary-on-clean', (f) => { delete f.expect._variance; return f; }),
    '78b without minSeverity': mutate('78b-post-summary-on-clean', (f) => {
      f.overlayYaml = f.overlayYaml.replace(/^minSeverity:.*$/m, ''); return f;
    }),
  };
  for (const [what, set] of Object.entries(cases)) {
    assert.ok(labelViolations(set).length > 0, `${what} was not caught`);
  }
});
