-- =====================================================
-- Diagnostic: Check user_metadata table and create if needed
-- =====================================================

-- Check if user_metadata table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_metadata') THEN
    RAISE NOTICE '✅ user_metadata table exists';
    
    -- Show table structure
    RAISE NOTICE 'Table columns:';
  ELSE
    RAISE NOTICE '❌ user_metadata table DOES NOT exist - creating it now...';
    
    -- Create user_metadata table
    CREATE TABLE public.user_metadata (
      user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CHECK (role IN ('user', 'editor'))
    );
    
    -- Enable RLS
    ALTER TABLE public.user_metadata ENABLE ROW LEVEL SECURITY;
    
    -- Create policies
    CREATE POLICY "Users can read their own metadata" ON public.user_metadata
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can insert their own metadata" ON public.user_metadata
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
    
    CREATE POLICY "Users can update their own metadata" ON public.user_metadata
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id);
      
    -- Allow server (service role) to read all metadata for role checking
    CREATE POLICY "Service role can read all metadata" ON public.user_metadata
      FOR SELECT
      TO service_role
      USING (true);
    
    -- Allow server to create metadata for new users
    CREATE POLICY "Service role can insert metadata" ON public.user_metadata
      FOR INSERT
      TO service_role
      WITH CHECK (true);
    
    RAISE NOTICE '✅ user_metadata table created with RLS policies';
  END IF;
END $$;

-- Show all rows
SELECT 
  user_id,
  role,
  created_at,
  updated_at
FROM public.user_metadata
ORDER BY created_at DESC;

-- Show count by role
SELECT 
  role,
  COUNT(*) as count
FROM public.user_metadata
GROUP BY role;

-- If no rows exist, show instructions
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO row_count FROM public.user_metadata;
  
  IF row_count = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  No user metadata found!';
    RAISE NOTICE '';
    RAISE NOTICE 'To make yourself an editor, get your user_id from auth.users:';
    RAISE NOTICE '  SELECT id, email FROM auth.users;';
    RAISE NOTICE '';
    RAISE NOTICE 'Then insert a row:';
    RAISE NOTICE '  INSERT INTO public.user_metadata (user_id, role)';
    RAISE NOTICE '  VALUES (''YOUR-USER-ID-HERE'', ''editor'');';
    RAISE NOTICE '';
  END IF;
END $$;
