-- Migration 0042: add the foo column.
-- Path includes slashes/numbers that historically broke Mermaid node IDs.

ALTER TABLE users
  ADD COLUMN foo TEXT NOT NULL DEFAULT '';

CREATE INDEX users_foo_idx ON users (foo);
