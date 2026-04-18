-- ====================================
-- Le Voyageur - Create Missing Tables
-- ====================================

-- Check if favorites table exists, create if not
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'favorites') THEN
    -- Create favorites table
    CREATE TABLE public.favorites (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, location_id)
    );

    -- Enable RLS
    ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

    -- Create policies
    CREATE POLICY "anon_read_favorites" ON public.favorites
      FOR SELECT
      TO anon, authenticated
      USING (true);

    CREATE POLICY "Users can insert their own favorites" ON public.favorites
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Users can delete their own favorites" ON public.favorites
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);

    -- Create indexes
    CREATE INDEX idx_favorites_user_id ON public.favorites(user_id);
    CREATE INDEX idx_favorites_location_id ON public.favorites(location_id);

    RAISE NOTICE '✅ Created favorites table with RLS policies';
  ELSE
    RAISE NOTICE 'ℹ️ favorites table already exists';
  END IF;
END $$;

-- Check if want_to_go table exists, create if not
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'want_to_go') THEN
    -- Create want_to_go table
    CREATE TABLE public.want_to_go (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, location_id)
    );

    -- Enable RLS
    ALTER TABLE public.want_to_go ENABLE ROW LEVEL SECURITY;

    -- Create policies
    CREATE POLICY "anon_read_want_to_go" ON public.want_to_go
      FOR SELECT
      TO anon, authenticated
      USING (true);

    CREATE POLICY "Users can insert their own want_to_go" ON public.want_to_go
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Users can delete their own want_to_go" ON public.want_to_go
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);

    -- Create indexes
    CREATE INDEX idx_want_to_go_user_id ON public.want_to_go(user_id);
    CREATE INDEX idx_want_to_go_location_id ON public.want_to_go(location_id);

    RAISE NOTICE '✅ Created want_to_go table with RLS policies';
  ELSE
    RAISE NOTICE 'ℹ️ want_to_go table already exists';
  END IF;
END $$;

-- Verify tables exist
SELECT 
  tablename,
  '✅ EXISTS' as status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('favorites', 'want_to_go', 'locations')
ORDER BY tablename;

-- Verify RLS is enabled
SELECT 
  tablename,
  CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as rls_status
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public' 
  AND tablename IN ('favorites', 'want_to_go', 'locations')
ORDER BY tablename;

-- Count rows in each table
SELECT 
  'favorites' as table_name,
  COUNT(*) as row_count
FROM public.favorites
UNION ALL
SELECT 
  'want_to_go' as table_name,
  COUNT(*) as row_count
FROM public.want_to_go
UNION ALL
SELECT 
  'locations' as table_name,
  COUNT(*) as row_count
FROM public.locations;

-- Test anonymous access
SET ROLE anon;

SELECT 'Testing anon SELECT from favorites...' as test;
SELECT COUNT(*) as favorites_count FROM public.favorites;

SELECT 'Testing anon SELECT from want_to_go...' as test;
SELECT COUNT(*) as want_to_go_count FROM public.want_to_go;

RESET ROLE;

SELECT '✅ Tables created and verified!' as status;
