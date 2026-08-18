// Best-effort loader for the remote payload. Failures of any kind degrade
// to null so callers can fall back to local defaults.

export async function tryLoad(): Promise<unknown> {
  try {
    return await fetchRemote();
  } catch {
    // Intentional fail-safe — surface a sentinel rather than propagate.
    return null;
  }
}

declare function fetchRemote(): Promise<unknown>;
