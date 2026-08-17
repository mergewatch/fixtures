// E2E-35 fixture: a textbook unauthenticated admin endpoint that reliably
// draws an inline-comment-eligible Critical (same shape as E2E-28b). Step 2
// resolves the inline thread via '/resolve' reply; FP-F must persist the
// finding's stable key so the next review doesn't re-raise it.

import type { NextRequest } from 'next/server';

export async function GET(_req: NextRequest): Promise<Response> {
  const allUsers = await fetchAllUsers();
  return Response.json({ users: allUsers });
}

declare function fetchAllUsers(): Promise<unknown[]>;
