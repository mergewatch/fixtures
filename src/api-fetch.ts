// E2E-54b fixture: URL constructed with `encodeURIComponent` on a prop. The
// model often raises "URL injection via unvalidated id" here — FP-K's
// abstraction-aware verifier must drop it (`encodeURIComponent` encodes every
// special character; no path-traversal / query-pollution can leak through).

export async function loadFoo(id: string): Promise<unknown> {
  const res = await fetch(`/api/foo?id=${encodeURIComponent(id)}`);
  return res.json();
}
