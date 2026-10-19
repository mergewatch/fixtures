export async function runMigrations(): Promise<void> {
  await globalThis.migrator.up({ dir: 'migrations' });
}

export async function startKbPostgres(): Promise<void> {
  await globalThis.kbPostgres.start();
}

declare global {
  // eslint-disable-next-line no-var
  var migrator: { up(opts: { dir: string }): Promise<void> };
  // eslint-disable-next-line no-var
  var kbPostgres: { start(): Promise<void>; stop(): Promise<void> };
}

export {};
