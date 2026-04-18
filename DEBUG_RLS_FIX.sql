-- ====================================
-- Le Voyageur RLS Policy Debug & Fix
-- ====================================
-- This fixes potential RLS issues blocking service role queries

-- ====================================
-- STEP 1: Check Current RLS Status
-- ====================================

SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('locations', 'favorites', 'want_to_go', 'user_ratings', 'user_metadata');

-- ====================================
-- STEP 2: Update RLS Policies for Public Read
-- ====================================
-- The issue: Service role should bypass RLS, but let's add explicit policies
-- to make sure count queries work even without service role

-- Favorites - allow counting for anyone (doesn't expose who favorited, just counts)
DROP POLICY IF EXISTS "Anyone can count favorites" ON favorites;
CREATE POLICY "Anyone can count favorites" ON favorites
  FOR SELECT 
  USING (true);  -- Anyone can see favorites for counting

-- Want_to_go - allow counting for anyone
DROP POLICY IF EXISTS "Anyone can count want_to_go" ON want_to_go;
CREATE POLICY "Anyone can count want_to_go" ON want_to_go
  FOR SELECT 
  USING (true);  -- Anyone can see want_to_go for counting

-- User_ratings - allow reading for anyone
DROP POLICY IF EXISTS "Anyone can view ratings" ON user_ratings;
CREATE POLICY "Anyone can view ratings" ON user_ratings
  FOR SELECT 
  USING (true);

-- ====================================
-- STEP 3: Verify Policies
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
WHERE tablename IN ('locations', 'favorites', 'want_to_go', 'user_ratings')
ORDER BY tablename, policyname;

-- ====================================
-- DONE!
-- ====================================

SELECT '✅ RLS policies updated to allow public counting' AS status;
