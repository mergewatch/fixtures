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
