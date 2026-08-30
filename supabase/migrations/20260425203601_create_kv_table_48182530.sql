-- Reconstructed from the original Figma Make scaffold (kv_store.tsx header
-- comment) to reconcile local migration history with what's already applied
-- on the remote database. No schema change - this file documents a
-- migration that was already run before this repo tracked migrations.

CREATE TABLE IF NOT EXISTS kv_store_48182530 (
  key TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL
);
