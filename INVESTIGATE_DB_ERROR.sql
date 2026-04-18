-- ====================================
-- Le Voyageur Database Error Investigation
-- ====================================
-- Run this to diagnose the "Bad Request" error

-- ====================================
-- STEP 1: Check if tables exist
-- ====================================

SELECT 
  table_name,
  table_schema
FROM information_schema.tables
WHERE table_name IN ('favorites', 'want_to_go', 'locations')
ORDER BY table_name;

-- ====================================
-- STEP 2: Check table permissions
-- ====================================

SELECT 
  grantee,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name IN ('favorites', 'want_to_go')
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee;

-- ====================================
-- STEP 3: Check RLS status
-- ====================================

SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('favorites', 'want_to_go');

-- ====================================
-- STEP 4: Check RLS policies
-- ====================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('favorites', 'want_to_go')
ORDER BY tablename, policyname;

-- ====================================
-- STEP 5: Test query directly
-- ====================================

-- This should show if the query works at all
SELECT COUNT(*) as favorites_count FROM favorites;
SELECT COUNT(*) as want_to_go_count FROM want_to_go;

-- ====================================
-- STEP 6: Check columns
-- ====================================

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('favorites', 'want_to_go')
ORDER BY table_name, ordinal_position;

-- ====================================
-- DONE!
-- ====================================

SELECT '✅ Investigation complete - check results above' AS status;
