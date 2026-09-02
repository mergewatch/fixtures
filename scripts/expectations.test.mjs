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
