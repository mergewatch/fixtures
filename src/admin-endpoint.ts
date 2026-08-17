// E2E-40 fixture: textbook unauthenticated admin endpoint that reliably
// draws an inline-comment-eligible Critical. Step 2 replies to the inline
// thread with `/mergewatch reject <category> [reason]` and verifies the
// FindingDispositionRecord captures the rejection + the bot posts a
// structured confirmation reply.

import type { NextRequest } from 'next/server';

export async function GET(_req: NextRequest): Promise<Response> {
  const allUsers = await fetchAllUsers();
  return Response.json({ users: allUsers });
}

declare function fetchAllUsers(): Promise<unknown[]>;
