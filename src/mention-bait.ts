export async function fetchProfile(userId: string): Promise<unknown> {
  const res = await fetch(`https://api.example.com/users/${userId}`);
  return res.json();
}
