-- ====================================
-- Le Voyageur - Simple Search Path Security Fix
-- ====================================
-- This fixes the trigger_update_location_score search_path vulnerability

-- ====================================
-- View Current Function (for reference)
-- ====================================

SELECT pg_get_functiondef(oid) AS current_definition
FROM pg_proc
WHERE proname = 'trigger_update_location_score'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ====================================
-- Drop and Recreate with Secure Search Path
-- ====================================

-- Drop the existing function
DROP FUNCTION IF EXISTS public.trigger_update_location_score() CASCADE;

-- Recreate with secure search_path
CREATE OR REPLACE FUNCTION public.trigger_update_location_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  avg_rating NUMERIC;
  rating_count INTEGER;
  new_score NUMERIC;
BEGIN
  -- Calculate average rating and count for this location
  SELECT 
    COALESCE(AVG(rating), 0),
    COUNT(*)
  INTO avg_rating, rating_count
  FROM public.user_ratings
  WHERE location_id = COALESCE(NEW.location_id, OLD.location_id);

  -- Calculate LV score (average rating)
  new_score := avg_rating;

  -- Update the location's lv_score
  UPDATE public.locations
  SET lv_score = new_score
  WHERE id = COALESCE(NEW.location_id, OLD.location_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ====================================
-- Recreate the Trigger
-- ====================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_location_score_trigger ON public.user_ratings;

-- Recreate trigger
CREATE TRIGGER update_location_score_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.user_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_location_score();

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
WHERE proname = 'trigger_update_location_score'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Verify trigger exists
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'update_location_score_trigger';

-- ====================================
-- DONE!
-- ====================================

SELECT '✅ Security fix applied - trigger_update_location_score now has search_path set' AS status;
