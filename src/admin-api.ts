import type { NextRequest } from 'next/server';
import { requireAdmin, AdminAuthError } from '@/auth';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return new Response('Forbidden', { status: 403 });
    }
    return new Response('Server error', { status: 500 });
  }
  const transcripts = await fetchAllTranscripts();
  return Response.json({ transcripts });
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    await requireAdmin(req);
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return new Response('Forbidden', { status: 403 });
    }
    return new Response('Server error', { status: 500 });
  }
  const { id } = await req.json();
  // Parameterized query — string concatenation is gone.
  const result = await db.prepare('SELECT * FROM users WHERE id = ?', [id]);
  return Response.json(result);
}

declare const db: { prepare(sql: string, params: unknown[]): Promise<unknown> };
declare function fetchAllTranscripts(): Promise<unknown[]>;
declare class AdminAuthError extends Error {}
declare function requireAdmin(req: NextRequest): Promise<void>;
