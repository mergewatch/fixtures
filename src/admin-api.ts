import type { NextRequest } from 'next/server';

// No authentication — anyone can hit this admin endpoint.
export async function GET(_req: NextRequest) {
  const transcripts = await fetchAllTranscripts();
  return Response.json({ transcripts });
}

// User-controlled SQL.
export async function POST(req: NextRequest) {
  const { id } = await req.json();
  const result = await db.raw(`SELECT * FROM users WHERE id = '${id}'`);
  return Response.json(result);
}

declare const db: { raw(sql: string): Promise<unknown> };
declare function fetchAllTranscripts(): Promise<unknown[]>;
