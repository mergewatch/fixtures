// E2E-50 fixture: the code already calls `console.warn('failed', err)` on
// the catch path. The "log the error" finding the model often emits would
// have a suggestion byte-equivalent to the existing line — FP-I L2's
// suggestionMatchesExistingCode short-circuit must drop it without an LLM
// call.

export async function doWork(): Promise<void> {
  try {
    await runRiskyThing();
  } catch (err) {
    console.warn('failed', err);
  }
}

declare function runRiskyThing(): Promise<void>;
