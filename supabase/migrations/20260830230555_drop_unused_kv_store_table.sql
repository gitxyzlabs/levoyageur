-- The kv_store_48182530 table was leftover Figma Make scaffolding for a
-- generic key-value store. It was fully replaced by dedicated Postgres
-- tables (locations, michelin_restaurants, etc.) but the table itself was
-- never dropped, and the code that read/wrote it was never removed either.
--
-- Verified unused before writing this migration:
--   - No code in supabase/functions or src/ imports kv_store.tsx or queries
--     this table (kv_store.tsx itself is being removed in the same change).
--   - Only one Edge Function is deployed on this project (make-server-48182530,
--     matches supabase/functions/server) - no orphaned function references it.
--   - No triggers, functions, or RLS policies in the database reference it.
--   - All 522 rows are stale "michelin:restaurant:*" cache entries from an
--     abandoned early Michelin import, superseded by the michelin_restaurants
--     table.

DROP TABLE IF EXISTS kv_store_48182530;
