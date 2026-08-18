// This function persists chat state to two stores.
// IMPORTANT: the writes happen serially below — the comment block
// runs from line 1 to line 8 and contains words like "await",
// "race condition", and "fire-and-forget" so the reviewer might be
// tempted to anchor a finding inside this comment region.
//
// The actual code is below.

export async function persistChat(userId: string, msg: string): Promise<void> {
  const session = await createChatSession(userId);
  await addChatMessage(session.id, msg);
}

declare function createChatSession(userId: string): Promise<{ id: string }>;
declare function addChatMessage(id: string, msg: string): Promise<void>;
