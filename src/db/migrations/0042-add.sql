-- 0042: add users.foo, backing the new profile flags UI.

ALTER TABLE users
  ADD COLUMN foo TEXT NOT NULL DEFAULT '';

CREATE INDEX users_foo_idx ON users (foo);
