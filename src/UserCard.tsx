// E2E-54c fixture: plain {x} JSX interpolation (no dangerouslySetInnerHTML).
// React auto-escapes text content — "XSS via user.name" findings here must
// be dropped by FP-K. The fail-safe rule preserves dangerouslySetInnerHTML
// findings (which are NOT safe).

import * as React from 'react';

type User = { id: string; name: string };

export function UserCard({ user }: { user: User }): React.ReactElement {
  return (
    <div className="user-card">
      <h3>{user.name}</h3>
      <small>{user.id}</small>
    </div>
  );
}
