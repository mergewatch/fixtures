export async function loadFoo(id: string): Promise<unknown> {
  const res = await fetch(`/api/foo?id=${encodeURIComponent(id)}`);
  return res.json();
}
