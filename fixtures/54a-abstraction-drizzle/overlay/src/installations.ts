import { db } from './db';
import { installations } from './schema';
import { eq } from 'drizzle-orm';

export async function fetchInstallation(installationId: string) {
  return db
    .select()
    .from(installations)
    .where(eq(installations.installationId, installationId));
}
