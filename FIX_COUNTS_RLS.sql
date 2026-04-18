-- ====================================
-- Le Voyageur - Fix Favorites/Want-to-Go Count RLS Policies
-- ====================================
-- This adds policies to allow anonymous users to read count data

-- ====================================
-- Favorites Table - Add Public Read Policy
-- ====================================

-- Drop existing policies if they're too restrictive
DROP POLICY IF EXISTS "Enable read access for all users" ON public.favorites;
DROP POLICY IF EXISTS "Public read access for counts" ON public.favorites;
DROP POLICY IF EXISTS "anon_read_favorites" ON public.favorites;

-- Create a policy that allows anonymous users to read favorites for counting
CREATE POLICY "anon_read_favorites" ON public.favorites
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Users can still only insert/update/delete their own favorites
DROP POLICY IF EXISTS "Users can insert their own favorites" ON public.favorites;
CREATE POLICY "Users can insert their own favorites" ON public.favorites
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own favorites" ON public.favorites;
CREATE POLICY "Users can delete their own favorites" ON public.favorites
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ====================================
-- Want-to-Go Table - Add Public Read Policy
-- ====================================

-- Drop existing policies if they're too restrictive
DROP POLICY IF EXISTS "Enable read access for all users" ON public.want_to_go;
DROP POLICY IF EXISTS "Public read access for counts" ON public.want_to_go;
DROP POLICY IF EXISTS "anon_read_want_to_go" ON public.want_to_go;

-- Create a policy that allows anonymous users to read want-to-go for counting
CREATE POLICY "anon_read_want_to_go" ON public.want_to_go
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Users can still only insert/update/delete their own want-to-go items
DROP POLICY IF EXISTS "Users can insert their own want_to_go" ON public.want_to_go;
CREATE POLICY "Users can insert their own want_to_go" ON public.want_to_go
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own want_to_go" ON public.want_to_go;
CREATE POLICY "Users can delete their own want_to_go" ON public.want_to_go
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ====================================
-- Verify Policies
-- ====================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('favorites', 'want_to_go')
ORDER BY tablename, cmd, policyname;

-- ====================================
-- Test Access as Anonymous User
-- ====================================

SET ROLE anon;

SELECT 'Testing favorites access...' as test;
SELECT COUNT(*) as favorites_count FROM public.favorites;

SELECT 'Testing want_to_go access...' as test;
SELECT COUNT(*) as want_to_go_count FROM public.want_to_go;

RESET ROLE;

-- ====================================
-- DONE!
-- ====================================

SELECT '✅ RLS policies updated - anonymous users can now read counts' AS status;
