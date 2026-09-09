export async function loadRemote(url: string): Promise<unknown> {
  const res = await fetch(url);
  return res.json();
}

// mergewatch.ai#570 / fixtures#2431 — the bait.
//
// This used to rely on `loadRemote` drawing "add try/catch around the fetch".
// W11 (Layering & responsibility) later told the model the opposite, in the
// shared preamble, in as many words:
//
//   "Do not flag 'missing try/catch around DB query' / 'should swallow / log
//    the error here' on a function whose contract is 'throw on failure'."
//
// `loadRemote` is exactly such a function, so the fixture was asking for a
// finding the product now deliberately suppresses. It was not flaky — it was
// obsolete.
//
// A missing `await` is not exempted by W11 or by the anti-pedantry rules: it is
// a defect that ships wrong behaviour, `results` ends up holding Promises
// rather than values, and the suggested fix is a single concrete edit — which
// is what step 2 needs to apply.
export async function loadAll(urls: string[]): Promise<unknown[]> {
  const results: unknown[] = [];
  for (const u of urls) {
    results.push(loadRemote(u));
  }
  return results;
}
