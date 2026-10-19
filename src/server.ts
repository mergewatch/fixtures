export async function startKbPostgres(): Promise<void> {
  await globalThis.kbPostgres.start();
}

declare global {
  // eslint-disable-next-line no-var
  var kbPostgres: { start(): Promise<void>; stop(): Promise<void> };
}

export {};
