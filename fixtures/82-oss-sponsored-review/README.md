# E2E-82: OSS Program — sponsored review on a granted public repo

A repository named in an active OSS grant (#261) is reviewed with **no balance, no
payment method, and no free-tier consumption**. Being named is necessary but not
sufficient — the repo must also be **public at review time**, the grant must not
have expired, and the month must be under its fair-use cap. See upstream
`docs/oss-program.md`. Shipped in #263 / #265.

OSS-program fixture, no fixture PR of its own: any diff that produces a real
review works (reuse **E2E-01**'s change). Needs a dedicated installation whose
free tier is exhausted and whose balance is 0 — the same starting state as
**E2E-73** step 2 — so run it on its own installation, never mid-suite.

## Prerequisites

1. Exhaust the free tier (`freeReviewsUsed >= 5`) and leave `balanceCents` at 0 —
   without a grant this install is blocked.
2. Grant the fixtures repo: `scripts/grant-oss.ts <owner>/<fixtures-repo> --stage dev`.

## Procedure

1. Open a PR (branch `fixture/82-oss-sponsored-review`, any real diff). Confirm it
   is reviewed normally despite zero balance.
2. Confirm the free-tier counter did **not** move and `balanceCents` is unchanged.
3. Confirm `ossSponsoredCentsThisPeriod` and `ossSponsoredCentsLifetime` increased
   by the review's cost.
4. Open a PR on a **different** public repo in the same installation that is *not*
   named in the grant → confirm it is blocked (credits copy).
5. Flip the granted repo to private, push again → confirm the next review is
   **not** sponsored.
6. Rename the granted repo, push again → confirm it **is** still sponsored
   (grants match on the numeric repo id).
7. Revoke the grant (`--revoke`) and push again → confirm it falls back to the
   free tier, not straight to a block.

## Expected outcomes

- [ ] Sponsored review completes with zero balance and no card on file.
- [ ] `freeReviewsUsed` unchanged; `balanceCents` unchanged; no Stripe activity.
- [ ] Both sponsored-cost counters increase by the review's cost.
- [ ] An unnamed public repo in the same installation is still gated.
- [ ] Flipping the repo private stops sponsorship on the next review.
- [ ] Renaming the repo does **not** stop sponsorship.
- [ ] A revoked grant degrades to the free tier.

## Failure modes

- ❌ A sponsored review consumes the free tier — a lapsed grant would then block
  the maintainer and file a "credits required" issue on their public repo.
- ❌ An unnamed repo in a granted installation is sponsored (open-core leak).
- ❌ A repo flipped private stays sponsored (the cost leak an approval-time check
  cannot catch).
- ❌ Any Stripe call on the sponsored path.
