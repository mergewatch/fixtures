// E2E-23 step 1: a broad catch that reliably draws one stable warning.
// The catch-all is the intentional fail-safe — step 2 posts a triage rebuttal
// then adds a log line (shifting subsequent line numbers) to verify that the
// rebutted finding is suppressed AND not duplicated as 🆕 new under a
// reworded title.

export async function tryLoad(): Promise<unknown> {
  try {
    return await fetchRemote();
  } catch {
    // Intentional fail-safe — surface a sentinel rather than propagate.
    return null;
  }
}

declare function fetchRemote(): Promise<unknown>;
