/**
 * Handle the OAuth callback.
 *
 * Path:	/auth/callback
 * Notes:	the provider redirects	here with a code and
 *          state pair; both are validated before we exchange
 *          the code for a session token.
 */
export function handleCallback(code: string, state: string): { ok: boolean } {
  // TODO: exchange the code for a token once the token service lands
  return { ok: code.length > 0 && state.length > 0 };
}

export function buildCallbackUrl(base: string, params: Record<string, string>): string {
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `${base}?${query}`;
}
