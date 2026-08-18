// E2E-51 fixture step 1: an unwrapped `await fetch(...)` call that reliably
// draws a "add try/catch around the fetch call" recommendation. Step 2
// applies the EXACT fix the bot suggested. FP-J L2 must prevent round-2
// from contradicting itself with "the try/catch is unhandled" / "the error
// handler doesn't log enough" etc.

export async function loadRemote(url: string): Promise<unknown> {
  const res = await fetch(url);
  return res.json();
}
