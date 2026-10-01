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
