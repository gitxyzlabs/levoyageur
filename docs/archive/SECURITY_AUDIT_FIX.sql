-- ====================================
-- Le Voyageur Security Audit & Fix
-- ====================================
-- This addresses Supabase-identified security threats
-- Run this in Supabase SQL Editor

-- ====================================
-- STEP 1: Identify All Tables and Their RLS Status
-- ====================================

SELECT 
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  CASE 
    WHEN rowsecurity = true THEN '✅ Protected'
    ELSE '⚠️ VULNERABLE - RLS NOT ENABLED'
  END AS security_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity ASC, tablename;

-- ====================================
-- STEP 2: List All Backup Tables
-- ====================================

SELECT 
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND (tablename LIKE '%backup%' OR tablename LIKE '%old%' OR tablename LIKE '%temp%')
ORDER BY tablename;

-- ====================================
-- STEP 3: Check michelin_restaurants_backup Table
-- ====================================

-- Check if the backup table exists and its row count
SELECT 
  COUNT(*) as row_count,
  '⚠️ This backup table should be dropped or secured' as recommendation
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name = 'michelin_restaurants_backup';

-- ====================================
-- STEP 4: Fix Option A - DROP Backup Table (RECOMMENDED)
-- ====================================
-- Since this is a backup table and data should be in the main `locations` table,
-- it's safest to drop it entirely

DROP TABLE IF EXISTS public.michelin_restaurants_backup CASCADE;

-- ====================================
-- STEP 5: Fix Option B - Enable RLS (if you need to keep it)
-- ====================================
-- Uncomment below if you need to keep the backup table:

-- ALTER TABLE public.michelin_restaurants_backup ENABLE ROW LEVEL SECURITY;

-- -- Create restrictive policy - only service role can access
-- DROP POLICY IF EXISTS "Service role only access" ON michelin_restaurants_backup;
-- CREATE POLICY "Service role only access" ON michelin_restaurants_backup
--   USING (false);  -- Block all access via PostgREST, only service role bypasses

-- ====================================
-- STEP 6: Audit ALL Other Tables for RLS
-- ====================================

-- Enable RLS on any tables that are missing it
-- (This is a safety check for all tables)

DO $$
DECLARE
  table_record RECORD;
BEGIN
  FOR table_record IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND rowsecurity = false
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT IN (
        'michelin_restaurants_backup',  -- We dropped this
        'spatial_ref_sys',              -- PostGIS system table
        'geography_columns',            -- PostGIS system table
        'geometry_columns'              -- PostGIS system table
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_record.tablename);
    RAISE NOTICE 'Enabled RLS on table: %', table_record.tablename;
  END LOOP;
END $$;

-- ====================================
-- STEP 7: Verify All Core Tables Have RLS
-- ====================================

SELECT 
  tablename,
  rowsecurity AS rls_enabled,
  CASE 
    WHEN rowsecurity = true THEN '✅ Secured'
    ELSE '⚠️ Still vulnerable'
  END AS status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'locations',
    'favorites', 
    'want_to_go',
    'user_ratings',
    'user_metadata',
    'lv_tags'
  )
ORDER BY tablename;

-- ====================================
-- STEP 8: Review All RLS Policies
-- ====================================

SELECT 
  tablename,
  policyname,
  cmd AS operation,
  CASE 
    WHEN permissive = 'PERMISSIVE' THEN '✅ Permissive'
    ELSE 'Restrictive'
  END AS policy_type,
  qual AS policy_condition
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ====================================
-- STEP 9: Security Summary
-- ====================================

SELECT 
  COUNT(*) FILTER (WHERE rowsecurity = true) AS tables_with_rls,
  COUNT(*) FILTER (WHERE rowsecurity = false) AS tables_without_rls,
  COUNT(*) AS total_public_tables
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns');

-- ====================================
-- DONE!
-- ====================================

SELECT 
  '✅ Security audit complete' AS status,
  'michelin_restaurants_backup table has been dropped' AS action_taken,
  'All production tables should now have RLS enabled' AS result;
