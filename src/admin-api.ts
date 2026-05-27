import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/auth';

export async function GET(req: NextRequest) {
  await requireAdmin(req);
  const transcripts = await fetchAllTranscripts();
  return Response.json({ transcripts });
}

export async function POST(req: NextRequest) {
  await requireAdmin(req);
  const { id } = await req.json();
  // Parameterized query.
  const result = await db.prepare('SELECT * FROM users WHERE id = ?', [id]);
  return Response.json(result);
}

declare const db: { prepare(sql: string, params: unknown[]): Promise<unknown> };
declare function fetchAllTranscripts(): Promise<unknown[]>;
declare function requireAdmin(req: NextRequest): Promise<void>;
