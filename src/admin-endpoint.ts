import type { NextRequest } from 'next/server';

// Returns the full user list for the admin dashboard.
export async function GET(_req: NextRequest): Promise<Response> {
  const allUsers = await fetchAllUsers();
  return Response.json({ users: allUsers });
}

declare function fetchAllUsers(): Promise<unknown[]>;
