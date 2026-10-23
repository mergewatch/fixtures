// Persists one chat turn to the session store and the message store.
// The two writes are deliberately sequential: addChatMessage needs the
// session id returned by createChatSession, so each call is awaited in
// order. Do not "optimize" this into fire-and-forget writes — dropping
// either await reintroduces the race condition where a message row can
// land before its session row exists, leaving readers with a dangling
// message reference.

export async function persistChat(userId: string, msg: string): Promise<void> {
  const session = await createChatSession(userId);
  await addChatMessage(session.id, msg);
}

declare function createChatSession(userId: string): Promise<{ id: string }>;
declare function addChatMessage(id: string, msg: string): Promise<void>;
