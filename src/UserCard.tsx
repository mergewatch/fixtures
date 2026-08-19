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
