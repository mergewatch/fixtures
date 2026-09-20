import { add } from '../../utils';

export type User = { id: string; name: string };

export function tally(users: User[]): number {
  return users.reduce((acc, _u) => add(acc, 1), 0);
}

export function findById(users: User[], id: string): User | undefined {
  return users.find((u) => u.id === id);
}
