// E2E-24 step 1: same bait as E2E-23 — a broad catch that draws one stable
// warning. Step 2 posts the triage rebuttal from a NON-author account; the
// re-review must STILL re-raise the warning (suppression is author-only).

export async function tryLoad(): Promise<unknown> {
  try {
    return await fetchRemote();
  } catch {
    return null;
  }
}

declare function fetchRemote(): Promise<unknown>;
