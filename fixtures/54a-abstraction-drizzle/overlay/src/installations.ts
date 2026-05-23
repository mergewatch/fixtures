// E2E-54a fixture: Drizzle `eq()` query on a URL-parameter value. The model
// often raises "SQL injection via unvalidated installationId" here — FP-K's
// abstraction-aware verifier must drop it (`eq()` parameterizes the value;
// no raw concatenation can leak through).

import { db } from './db';
import { installations } from './schema';
import { eq } from 'drizzle-orm';

export async function fetchInstallation(installationId: string) {
  return db
    .select()
    .from(installations)
    .where(eq(installations.installationId, installationId));
}
