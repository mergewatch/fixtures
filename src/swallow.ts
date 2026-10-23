export async function tryLoad(): Promise<unknown> {
  try {
    return await fetchRemote();
  } catch {
    return null;
  }
}

declare function fetchRemote(): Promise<unknown>;
