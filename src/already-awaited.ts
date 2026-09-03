export async function runMigrations(): Promise<string[]> {
  const run = await migrationRunner({ dir: 'migrations', direction: 'up' });
  return run.map((m) => m.name);
}

declare function migrationRunner(opts: { dir: string; direction: 'up' | 'down' }): Promise<{ name: string }[]>;
