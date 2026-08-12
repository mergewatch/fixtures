// E2E-49 fixture step 1: real error-handling issues that the bot should
// legitimately flag. Step 2 fixes all of them + adds a tiny change to a
// DIFFERENT file (src/unrelated.ts) that has no error-handling code at all.
// FP-H must prevent the verifier from anchoring on round-1's "error
// handling" frame and pattern-matching it onto the unrelated file.

export async function processJob(id: string): Promise<void> {
  const job = await fetchJob(id);
  const result = await runJob(job);
  await saveResult(result);
}

export async function processBatch(ids: string[]): Promise<void> {
  for (const id of ids) {
    const job = await fetchJob(id);
    const result = await runJob(job);
    await saveResult(result);
  }
}

declare function fetchJob(id: string): Promise<unknown>;
declare function runJob(job: unknown): Promise<unknown>;
declare function saveResult(result: unknown): Promise<void>;
