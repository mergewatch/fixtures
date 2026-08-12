// E2E-39 fixture: textbook unauthenticated admin endpoint that reliably
// draws an inline-comment-eligible Critical. Step 2 adds reactions on the
// inline bot comment (👎, 🚀) and verifies the FindingDispositionRecord's
// disputeCount / agreementCount counters update correctly.

import type { NextRequest } from 'next/server';

export async function GET(_req: NextRequest): Promise<Response> {
  const allUsers = await fetchAllUsers();
  return Response.json({ users: allUsers });
}

declare function fetchAllUsers(): Promise<unknown[]>;
