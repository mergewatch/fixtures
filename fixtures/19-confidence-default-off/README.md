# E2E-19: Confidence scores hidden by default

A fresh MergeWatch install should NOT render `XX%` confidence badges next to findings. The flag still exists (`InstallationSettings.summary.confidenceScore`) and users can opt back in via the dashboard, but the default is off because LLM-self-reported confidence has been observed to be miscalibrated against actual hit rate.

## Apply

```bash
./scripts/apply-fixture.sh 19-confidence-default-off
```

Don't touch any dashboard settings before running.

## Expected outcomes

- [ ] Summary comment includes a "Requires your attention" or "Info" section with at least one finding
- [ ] **No finding row contains a `XX%` badge** — neither in the action-items table nor in the Info collapsible
- [ ] If you turn the setting back on (Settings → Summary → "Show confidence scores"), the next review's findings DO show the badge

## Failure modes

- ❌ `85%`, `90%`, etc. badges appear on a default install (regression of the default flip)

## What the graded assertion matches, and why it is narrow

The badge has exactly one render site — `comment-formatter.ts:423`, ``` ` ${f.confidence}% ` ``` —
so it is always **backtick-wrapped**. The assertion requires the backticks:

```json
"mustNotMatch": ["`\\d{1,3}%`"]
```

A bare `\d{1,3}%` was used previously, with a negative lookahead to skip the
percent-encoded View-full-details link. That handled URLs but not prose: on
mergewatch.ai@45fc2c3 this fixture blocked production because the orchestrator's
own sentence said *"does not meet the 75% confidence threshold for reporting"* —
on a change that emits no percentages at all. A review about confidence
filtering is the review most likely to use that vocabulary (#3259).

**Do not re-add the lookahead.** It only ever compensated for matching bare
percentages; with the backticks required it guards nothing.
- ❌ The setting toggle in the dashboard doesn't have any effect
