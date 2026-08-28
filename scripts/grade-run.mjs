#!/usr/bin/env node
/**
 * Deterministically grade the last suite run against each fixture's
 * expect.json (#416, stage 3).
 *
 * The existing /verify-suite command grades by having an LLM read each
 * fixture's prose README. That covers the qualitative outcomes nothing else
 * can, but it needs a model, it is non-deterministic, and it therefore cannot
 * hard-gate a deploy. This grader handles the assertable subset with no model
 * in the loop, and exits non-zero when something regresses.
 *
 * A fixture with no expect.json is reported UNGRADED — never PASS. Silently
 * counting an unasserted fixture as passing is the failure mode that would
 * make this whole layer worthless.
 *
 * Usage:
 *   scripts/grade-run.mjs                    # grade the prod review
 *   scripts/grade-run.mjs --stage dev        # grade the dev review
 *   scripts/grade-run.mjs --compare          # grade both, report divergence
 *   scripts/grade-run.mjs --manifest path    # default .e2e/last-run.json
 *   scripts/grade-run.mjs --json             # machine-readable output
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

// --- CLI --------------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};
const has = (name) => argv.includes(name);

const MANIFEST = flag('--manifest', '.e2e/last-run.json');
const COMPARE = has('--compare');
const AS_JSON = has('--json');
const STAGE = COMPARE ? null : flag('--stage', null); // null → prod

/**
 * Comment marker for a stage. Mirrors packages/core/src/stage.ts upstream —
 * prod's marker is frozen, so this literal is safe to hard-code, and a
 * mismatch here would make the grader silently find no comment at all.
 */
/**
 * GitHub App login that authors this stage's review and comment.
 *
 * Do NOT try to detect "is it a bot" — `gh pr view --json reviews` returns
 * `author.is_bot: null` and a bare login (`mergewatch`, not `mergewatch[bot]`),
 * so every heuristic based on that silently matches nothing and reports the
 * review as missing. Found by grading a real PR that plainly had one.
 *
 * Overridable because the App slugs are deployment-specific.
 */
const APP_LOGIN = {
  prod: flag('--app-login', 'mergewatch'),
  dev: flag('--dev-app-login', 'mergewatch-ai-dev'),
};
const appLoginFor = (stage) => APP_LOGIN[!stage || stage === 'prod' ? 'prod' : 'dev'] ?? null;

const marker = (stage) =>
  !stage || stage === 'prod' ? '<!-- mergewatch-review -->' : `<!-- mergewatch-review:${stage} -->`;
const checkNameFor = (stage) =>
  !stage || stage === 'prod' ? 'MergeWatch Review' : `MergeWatch Review (${stage})`;

// --- GitHub -----------------------------------------------------------------
function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

function fetchPR(number) {
  const raw = gh(['pr', 'view', String(number), '--json',
    'comments,reviews,statusCheckRollup,reactionGroups,state,headRefOid']);
  return JSON.parse(raw);
}

/**
 * Check-run `output` (title + summary) for a commit.
 *
 * `statusCheckRollup` does NOT carry them — its fields are exactly
 * __typename, name, status, conclusion, startedAt, completedAt, detailsUrl,
 * workflowName. So `checkTitleMatches` was testing its regex against an empty
 * string and could never pass: E2E-06, -09 and -10 asserted a title no code
 * path could supply. The REST check-runs endpoint has the data.
 */
function fetchCheckOutputs(repo, sha) {
  if (!sha) return [];
  try {
    return JSON.parse(gh(['api', `repos/${repo}/commits/${sha}/check-runs`, '--paginate']))
      .check_runs ?? [];
  } catch {
    return [];
  }
}

function fetchInlineComments(repo, number) {
  try {
    return JSON.parse(gh(['api', `repos/${repo}/pulls/${number}/comments`, '--paginate']));
  } catch {
    return [];
  }
}

// --- Parsing ----------------------------------------------------------------
/** The bot's summary comment for this stage, or null. */
function findBotComment(pr, stage) {
  const m = marker(stage);
  // Last match wins: a re-review edits in place, but if anything ever posts a
  // second one, the newest is what a human would read.
  const hits = (pr.comments ?? []).filter((c) => (c.body ?? '').includes(m));
  return hits.length ? hits[hits.length - 1] : null;
}

/** Merge score 1-5 from the verdict badge, or null. */
function parseScore(body) {
  const m = /\*\*([1-5])\/5 —/.exec(body ?? '');
  return m ? Number(m[1]) : null;
}

/** Counts from the severity section headers the formatter emits. */
function parseFindingCounts(body) {
  const grab = (re) => { const m = re.exec(body ?? ''); return m ? Number(m[1]) : 0; };
  return {
    critical: grab(/### .{0,4} ?Critical \((\d+)\)/),
    warning: grab(/summary>.{0,4} ?Warnings \((\d+)\)/),
    info: grab(/summary>.{0,4} ?Info \((\d+)\)/),
  };
}

/**
 * Every rendered finding's `file` and `line`, from the comment body.
 *
 * The formatter emits each as ``- **`path:NN`** — Title``, so the anchor a
 * reader actually sees is recoverable without a model. This is what lets a
 * fixture assert WHERE a finding landed, not just how many there were —
 * the question E2E-17 and E2E-26 exist to ask, and the one the grader
 * previously had no way to express.
 */
function parseFindingAnchors(body) {
  const out = [];
  const re = /- \*\*`([^`]+):(\d+)`\*\* —/g;
  let m;
  while ((m = re.exec(body ?? '')) !== null) {
    out.push({ file: m[1], line: Number(m[2]) });
  }
  return out;
}

/** The stage's check run, or null when it never appeared. */
function findCheck(pr, stage, checkRuns = []) {
  const name = checkNameFor(stage);
  const runs = (pr.statusCheckRollup ?? []).filter((c) => c.name === name);
  const base = runs.length ? runs[runs.length - 1] : null;
  if (!base) return null;
  // Graft the output the rollup omits. Matched by name and taken last-wins for
  // the same reason as the rollup: a re-review replaces the check.
  const detailed = checkRuns.filter((c) => c.name === name);
  const out = detailed.length ? detailed[detailed.length - 1].output ?? {} : {};
  return { ...base, title: out.title ?? null, summary: out.summary ?? null };
}

/**
 * Most recent formal review authored by this stage's App.
 *
 * `login` is matched with the `[bot]` suffix optional, since GitHub reports it
 * inconsistently between REST and GraphQL. When the stage's summary comment is
 * present its author is authoritative — that is the same App by construction,
 * and it keeps this working if a deployment renames its App.
 */
function latestStageReview(pr, stage, commentAuthor) {
  const want = (commentAuthor ?? appLoginFor(stage) ?? '').replace(/\[bot\]$/, '').toLowerCase();
  const reviews = (pr.reviews ?? []).filter((r) => {
    const login = (r.author?.login ?? '').replace(/\[bot\]$/, '').toLowerCase();
    return want ? login === want : false;
  });
  return reviews.length ? reviews[reviews.length - 1] : null;
}

// --- Assertions -------------------------------------------------------------
/**
 * Evaluate one fixture's expect.json. Returns a list of failure strings —
 * empty means every assertion held.
 */
function evaluate(expect, observed) {
  const fail = [];
  const { comment, score, counts, check, review, inlineCount, reactions, anchors } = observed;

  if (expect.comment === 'present' && !comment) fail.push('expected a summary comment, found none');
  if (expect.comment === 'absent' && comment) fail.push('expected NO summary comment, found one');

  if (expect.score != null) {
    if (score == null) {
      fail.push('expected a merge score, none parsed from the comment');
    } else {
      const { min, max, is } = typeof expect.score === 'number' ? { is: expect.score } : expect.score;
      if (is != null && score !== is) fail.push(`score ${score}, expected exactly ${is}`);
      if (min != null && score < min) fail.push(`score ${score} below min ${min}`);
      if (max != null && score > max) fail.push(`score ${score} above max ${max}`);
    }
  }

  if (expect.findings) {
    for (const sev of ['critical', 'warning', 'info']) {
      const rule = expect.findings[sev];
      if (rule == null) continue;
      const got = counts[sev];
      const { min, max, is } = typeof rule === 'number' ? { is: rule } : rule;
      if (is != null && got !== is) fail.push(`${sev} findings ${got}, expected ${is}`);
      if (min != null && got < min) fail.push(`${sev} findings ${got} below min ${min}`);
      if (max != null && got > max) fail.push(`${sev} findings ${got} above max ${max}`);
    }
  }

  if (expect.check != null) {
    if (expect.check === 'none') {
      if (check) fail.push(`expected no check run, found ${check.conclusion ?? check.status}`);
    } else if (!check) {
      fail.push(`expected check ${expect.check}, found no check run`);
    } else {
      const got = (check.conclusion ?? '').toLowerCase();
      if (got !== expect.check.toLowerCase()) fail.push(`check ${got || check.status}, expected ${expect.check}`);
    }
  }
  if (expect.checkTitleMatches) {
    const title = check?.title ?? check?.output?.title ?? '';
    if (!new RegExp(expect.checkTitleMatches, 'i').test(title)) {
      fail.push(`check title ${JSON.stringify(title)} does not match /${expect.checkTitleMatches}/i`);
    }
  }
  // The skip *reason* lands in the check summary, not the title — the title is
  // a bare "Review skipped" for every kind. Asserting the reason is the only
  // way a fixture can tell maxFiles from autoReviewOff from a docs-only skip.
  if (expect.checkSummaryMatches) {
    const summary = check?.summary ?? check?.output?.summary ?? '';
    if (!new RegExp(expect.checkSummaryMatches, 'i').test(summary)) {
      fail.push(`check summary ${JSON.stringify(summary)} does not match /${expect.checkSummaryMatches}/i`);
    }
  }

  if (expect.reviewState != null) {
    const got = review?.state ?? 'none';
    if (expect.reviewState === 'none') {
      if (review) fail.push(`expected no formal review, found ${got}`);
    } else if (got !== expect.reviewState) {
      fail.push(`review state ${got}, expected ${expect.reviewState}`);
    }
  }
  if (expect.reviewBody === 'empty' && review && (review.body ?? '').trim() !== '') {
    // #132 — an APPROVE carrying a verdict body is a specific past regression.
    fail.push(`review body should be empty, got ${JSON.stringify(review.body.slice(0, 60))}`);
  }

  const body = comment?.body ?? '';
  for (const needle of expect.mustContain ?? []) {
    if (!body.includes(needle)) fail.push(`comment missing ${JSON.stringify(needle)}`);
  }
  for (const needle of expect.mustNotContain ?? []) {
    if (body.includes(needle)) fail.push(`comment must not contain ${JSON.stringify(needle)}`);
  }
  for (const re of expect.mustMatch ?? []) {
    if (!new RegExp(re).test(body)) fail.push(`comment does not match /${re}/`);
  }
  // The negated form. Needed where the contract is the ABSENCE of a shape
  // rather than of a fixed string — E2E-19's confidence badge is `XX%` with a
  // varying number, so mustNotContain cannot express it (fixtures#1076).
  for (const re of expect.mustNotMatch ?? []) {
    if (new RegExp(re).test(body)) fail.push(`comment must not match /${re}/`);
  }

  // Where a finding landed, not just that it exists. One-sided by design: a
  // file with no findings passes, so this can only fail when an anchor is
  // WRONG — never because a model declined to report something. E2E-02's
  // removed rule is the counter-example.
  for (const rule of expect.findingLines ?? []) {
    const hits = anchors.filter((a) => a.file === rule.file);
    for (const a of hits) {
      if (rule.in && !rule.in.includes(a.line)) {
        fail.push(`finding on ${a.file} anchored at line ${a.line}, expected one of ${rule.in.join(', ')}`);
      }
    }
  }

  if (expect.inlineComments != null) {
    const { min, max, is } = typeof expect.inlineComments === 'number'
      ? { is: expect.inlineComments } : expect.inlineComments;
    if (is != null && inlineCount !== is) fail.push(`${inlineCount} inline comments, expected ${is}`);
    if (min != null && inlineCount < min) fail.push(`${inlineCount} inline comments, below min ${min}`);
    if (max != null && inlineCount > max) fail.push(`${inlineCount} inline comments, above max ${max}`);
  }

  for (const r of expect.reactions?.present ?? []) {
    if (!reactions.includes(r)) fail.push(`expected reaction ${r} on the PR`);
  }
  for (const r of expect.reactions?.absent ?? []) {
    if (reactions.includes(r)) fail.push(`reaction ${r} should have been removed`);
  }

  return fail;
}

// --- Observation ------------------------------------------------------------
function observe(pr, repo, prNumber, stage) {
  const comment = findBotComment(pr, stage);
  const checkRuns = fetchCheckOutputs(repo, pr.headRefOid);
  const inline = fetchInlineComments(repo, prNumber)
    .filter((c) => (c.body ?? '').includes(
      !stage || stage === 'prod' ? '<!-- mergewatch-inline -->' : `<!-- mergewatch-inline:${stage} -->`));
  return {
    comment,
    score: parseScore(comment?.body),
    anchors: parseFindingAnchors(comment?.body),
    counts: parseFindingCounts(comment?.body),
    check: findCheck(pr, stage, checkRuns),
    review: latestStageReview(pr, stage, comment?.author?.login),
    inlineCount: inline.length,
    reactions: (pr.reactionGroups ?? []).filter((g) => (g.users?.totalCount ?? 0) > 0)
      .map((g) => g.content),
  };
}

// --- Main -------------------------------------------------------------------
if (!existsSync(MANIFEST)) {
  console.error(`No manifest at ${MANIFEST}. Run scripts/run-suite.sh first.`);
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const repo = manifest.repo && manifest.repo !== 'unknown'
  ? manifest.repo
  : gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']).trim();

const results = [];
for (const entry of manifest.fixtures ?? []) {
  const base = { fixture: entry.fixture, pr: entry.pr };

  if (entry.applied === 'skipped-missing-prereq') {
    results.push({ ...base, verdict: 'SKIP', notes: ['prerequisite missing — not a product failure'] });
    continue;
  }
  if (entry.pr == null) {
    results.push({ ...base, verdict: 'SKIP', notes: ['no PR (manual or reuse fixture)'] });
    continue;
  }

  const expectPath = `fixtures/${entry.fixture}/expect.json`;
  if (!existsSync(expectPath)) {
    results.push({ ...base, verdict: 'UNGRADED', notes: ['no expect.json — LLM rubric only'] });
    continue;
  }
  const expect = JSON.parse(readFileSync(expectPath, 'utf8'));

  let pr;
  try {
    pr = fetchPR(entry.pr);
  } catch (err) {
    results.push({ ...base, verdict: 'ERROR', notes: [`could not fetch PR: ${err.message.split('\n')[0]}`] });
    continue;
  }

  if (COMPARE) {
    const prodFails = evaluate(expect, observe(pr, repo, entry.pr, 'prod'));
    const devObs = observe(pr, repo, entry.pr, 'dev');
    const devFails = devObs.comment ? evaluate(expect, devObs) : ['no dev review comment found'];
    const prodScore = observe(pr, repo, entry.pr, 'prod').score;
    results.push({
      ...base,
      verdict: prodFails.length || devFails.length ? 'FAIL' : 'PASS',
      compare: {
        prod: { score: prodScore, fails: prodFails },
        dev: { score: devObs.score, fails: devFails },
        diverged: prodScore !== devObs.score,
      },
      notes: [
        ...prodFails.map((f) => `prod: ${f}`),
        ...devFails.map((f) => `dev: ${f}`),
        ...(prodScore !== devObs.score ? [`DIVERGENCE: prod ${prodScore}/5 vs dev ${devObs.score}/5`] : []),
      ],
    });
    continue;
  }

  const fails = evaluate(expect, observe(pr, repo, entry.pr, STAGE));
  results.push({ ...base, verdict: fails.length ? 'FAIL' : 'PASS', notes: fails });
}

/**
 * Correctness fixtures that this run did not touch at all.
 *
 * A fixture EXCLUDED by the selection never reaches the manifest, so it is not
 * reported as anything — not even SKIP. A run of `--tag correctness --automated
 * --graded` therefore prints "23 passed" while the other correctness fixtures
 * go unmentioned, and a reader reasonably concludes the correctness set is
 * covered. It is not: those checks simply did not happen.
 *
 * "Nobody checked" and "checked and clean" must not look the same. That is the
 * whole premise of the gate, and it was still true of its own summary.
 */
function unverifiedCorrectness(ranFixtures) {
  const ran = new Set(ranFixtures);
  const out = [];
  let dirs;
  try {
    dirs = readdirSync('fixtures', { withFileTypes: true })
      .filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return out; // not run from the fixtures repo root — say nothing rather than guess
  }
  for (const name of dirs.sort()) {
    if (ran.has(name)) continue;
    let meta = '';
    try {
      meta = readFileSync(`fixtures/${name}/meta.env`, 'utf8');
    } catch {
      continue;
    }
    const tags = (/^TAGS=(.*)$/m.exec(meta)?.[1] ?? '').split(',').map((t) => t.trim());
    if (!tags.includes('correctness')) continue;
    out.push({
      name,
      // Either flag means an unattended run cannot complete it, so both
      // belong in the manual bucket of the NOT VERIFIED line — counting a
      // human-step fixture as merely "ungraded" understates why it is unrun.
      manual: /^MANUAL_ONLY=true$/m.test(meta) || /^NEEDS_HUMAN_STEP=true$/m.test(meta),
      graded: existsSync(`fixtures/${name}/expect.json`),
    });
  }
  return out;
}

// --- Report -----------------------------------------------------------------
if (AS_JSON) {
  console.log(JSON.stringify({ repo, stage: STAGE ?? (COMPARE ? 'compare' : 'prod'), results }, null, 2));
} else {
  const ICON = { PASS: '✓', FAIL: '✗', SKIP: '⊘', UNGRADED: '·', ERROR: '!' };
  for (const r of results) {
    const pr = r.pr == null ? '' : ` #${r.pr}`;
    console.log(`${ICON[r.verdict]} ${r.verdict.padEnd(8)} ${r.fixture}${pr}`);
    for (const n of r.notes ?? []) console.log(`             ${n}`);
  }
  const tally = (v) => results.filter((r) => r.verdict === v).length;
  console.log('');
  console.log(`${tally('PASS')} passed · ${tally('FAIL')} failed · ${tally('UNGRADED')} ungraded · `
    + `${tally('SKIP')} skipped · ${tally('ERROR')} errored`);
  if (tally('UNGRADED')) {
    console.log('Ungraded fixtures have no expect.json — grade them with /verify-suite.');
  }

  // Everything carrying `correctness` that this selection left out. Reported,
  // never counted: these are not failures, and the exit code is unchanged.
  // But a summary that omits them lets a partial run read as a full one.
  const missed = unverifiedCorrectness(results.map((r) => r.fixture));
  if (missed.length) {
    const manual = missed.filter((m) => m.manual).length;
    const ungraded = missed.filter((m) => !m.manual && !m.graded).length;
    // Automated AND graded, just not selected. Expected for an impact-scoped
    // gate run; for a full release run this should be zero, and a non-zero
    // value there means the selection is narrower than it looks.
    const runnable = missed.filter((m) => !m.manual && m.graded).length;
    console.log('');
    console.log(`NOT VERIFIED: ${missed.length} correctness fixture(s) outside this run `
      + `— ${manual} manual, ${ungraded} ungraded, ${runnable} graded but not selected.`);
    console.log('  These were not checked. A green run above does not cover them.');
  }
}

// A fetch error is not a product regression, but it does mean the run was not
// actually verified — so it fails the gate rather than passing quietly.
process.exit(results.some((r) => r.verdict === 'FAIL' || r.verdict === 'ERROR') ? 1 : 0);
