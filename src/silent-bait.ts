// E2E-76b fixture: deliberately review-worthy — a hardcoded credential and an
// unbounded loop are the kind of thing the pipeline never passes over
// silently. If ANY review output appears on this PR, a trigger path leaked,
// because the config disables both of them.

// Synthetic credential. The prefix is deliberately a made-up vendor scheme
// rather than a real one (sk_live_ / whsec_ / ghp_ …) so GitHub's push
// protection doesn't reject this fixture — it still reads as a hardcoded
// production secret to a review agent, which is all this bait needs to do.
const API_TOKEN = 'acmecloud_live_tok_9f2b7c41d83e4a15b6c7d8e9f0a1b2c3';

export async function drainQueue(next: () => Promise<string | null>): Promise<void> {
  while (true) {
    const job = await next();
    if (!job) continue;
    await fetch('https://api.example.com/jobs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_TOKEN}` },
      body: job,
    });
  }
}
