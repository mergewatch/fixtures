// E2E-76a fixture: substantive enough that the automatic on-open review has
// something to report. That first review is the control — it proves the
// pipeline works here, so a missing SECOND review after '@mergewatch review'
// is attributable to reviewOnMention:false rather than to a broken install.

export async function fetchProfile(userId: string): Promise<unknown> {
  // No timeout and no non-2xx handling: a hung upstream hangs the caller, and
  // a 500 is parsed as if it were a profile.
  const res = await fetch(`https://api.example.com/users/${userId}`);
  return res.json();
}
