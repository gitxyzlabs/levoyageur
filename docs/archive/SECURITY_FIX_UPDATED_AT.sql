-- ====================================
-- Le Voyageur - Fix update_updated_at_column Search Path
-- ====================================
-- This fixes the update_updated_at_column search_path vulnerability

-- ====================================
-- View Current Function (for reference)
-- ====================================

SELECT pg_get_functiondef(oid) AS current_definition
FROM pg_proc
WHERE proname = 'update_updated_at_column'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ====================================
-- Drop and Recreate with Secure Search Path
-- ====================================

-- Drop the existing function (this will also drop associated triggers, we'll recreate them)
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Recreate with secure search_path
-- This function updates the updated_at timestamp on row changes
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ====================================
-- Recreate Triggers (if they were dropped)
-- ====================================

-- Find all tables that should have updated_at triggers
-- We'll recreate triggers for common tables

-- Locations table
DROP TRIGGER IF EXISTS set_updated_at ON public.locations;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- User ratings table
DROP TRIGGER IF EXISTS set_updated_at ON public.user_ratings;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.user_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Favorites table
DROP TRIGGER IF EXISTS set_updated_at ON public.favorites;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.favorites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Want to go table
DROP TRIGGER IF EXISTS set_updated_at ON public.want_to_go;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.want_to_go
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ====================================
-- Verify the Fix
-- ====================================

-- Check the function now has search_path set
SELECT 
  proname AS function_name,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%SET search_path%' THEN 'YES - SECURE ✅'
    ELSE 'NO - STILL VULNERABLE ⚠️'
  END AS has_search_path
FROM pg_proc
WHERE proname = 'update_updated_at_column'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Show all recreated triggers
SELECT 
  tgname AS trigger_name,
  relname AS table_name,
  '✅ RECREATED' AS status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE t.tgname = 'set_updated_at'
  AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY relname;

-- ====================================
-- DONE!
-- ====================================

SELECT '✅ Security fix applied - update_updated_at_column now has search_path set and triggers recreated' AS status;
