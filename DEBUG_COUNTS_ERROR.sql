-- ====================================
-- Le Voyageur - Debug Favorite/Want-to-Go Count Errors
-- ====================================

-- ====================================
-- Check if tables exist
-- ====================================

SELECT 
  tablename,
  '✅ EXISTS' as status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('favorites', 'want_to_go', 'locations')
ORDER BY tablename;

-- ====================================
-- Check RLS policies on favorites
-- ====================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'favorites';

-- ====================================
-- Check RLS policies on want_to_go
-- ====================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'want_to_go';

-- ====================================
-- Test SELECT on favorites (as anon user)
-- ====================================

SET ROLE anon;

-- Try to select from favorites
SELECT COUNT(*) as favorite_count
FROM public.favorites;

-- Try with a filter
SELECT location_id, COUNT(*) as count
FROM public.favorites
GROUP BY location_id
LIMIT 5;

RESET ROLE;

-- ====================================
-- Test SELECT on want_to_go (as anon user)
-- ====================================

SET ROLE anon;

-- Try to select from want_to_go
SELECT COUNT(*) as want_to_go_count
FROM public.want_to_go;

-- Try with a filter
SELECT location_id, COUNT(*) as count
FROM public.want_to_go
GROUP BY location_id
LIMIT 5;

RESET ROLE;

-- ====================================
-- Check if there's data in the tables
-- ====================================

SELECT 
  (SELECT COUNT(*) FROM public.favorites) as favorites_total,
  (SELECT COUNT(*) FROM public.want_to_go) as want_to_go_total,
  (SELECT COUNT(*) FROM public.locations) as locations_total;

-- ====================================
-- Sample some location IDs
-- ====================================

SELECT id, name, lv_tags
FROM public.locations
LIMIT 5;
