export async function doWork(): Promise<void> {
  try {
    await runRiskyThing();
  } catch (err) {
    console.warn('failed', err);
  }
}

declare function runRiskyThing(): Promise<void>;
