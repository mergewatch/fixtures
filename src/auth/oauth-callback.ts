/**
 * Handle the OAuth callback.
 *
 * Path:	/auth/callback
 * Notes:	the path includes	a tab and a
 *          newline in this docstring intentionally to stress the
 *          Mermaid sanitizer.
 */
export function handleCallback(code: string, state: string): { ok: boolean } {
  // pretend to do something with the code/state pair
  return { ok: code.length > 0 && state.length > 0 };
}

export function buildCallbackUrl(base: string, params: Record<string, string>): string {
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `${base}?${query}`;
}
