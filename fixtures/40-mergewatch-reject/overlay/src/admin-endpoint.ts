import type { NextRequest } from 'next/server';

// Lists all users so the admin console can render the accounts table.
export async function GET(_req: NextRequest): Promise<Response> {
  const allUsers = await fetchAllUsers();
  return Response.json({ users: allUsers });
}

declare function fetchAllUsers(): Promise<unknown[]>;
