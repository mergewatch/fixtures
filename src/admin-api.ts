import type { NextRequest } from 'next/server';

// Lists all transcripts for the admin dashboard.
export async function GET(_req: NextRequest) {
  const transcripts = await fetchAllTranscripts();
  return Response.json({ transcripts });
}

// Looks up a single user by id for the support view.
export async function POST(req: NextRequest) {
  const { id } = await req.json();
  const result = await db.raw(`SELECT * FROM users WHERE id = '${id}'`);
  return Response.json(result);
}

declare const db: { raw(sql: string): Promise<unknown> };
declare function fetchAllTranscripts(): Promise<unknown[]>;
