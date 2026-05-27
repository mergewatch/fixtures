import type { NextRequest } from 'next/server';

// No authentication — anyone can hit this admin endpoint.
// This is a textbook Critical to drive the REQUEST_CHANGES path
// for E2E-28 (single authoritative review comment).
export async function GET(_req: NextRequest): Promise<Response> {
  const allUsers = await fetchAllUsers();
  return Response.json({ users: allUsers });
}

declare function fetchAllUsers(): Promise<unknown[]>;
