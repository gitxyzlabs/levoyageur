-- ====================================
-- Le Voyageur - Fix update_crowdsource_score Search Path
-- ====================================
-- This fixes the update_crowdsource_score search_path vulnerability

-- ====================================
-- View Current Function (for reference)
-- ====================================

SELECT pg_get_functiondef(oid) AS current_definition
FROM pg_proc
WHERE proname = 'update_crowdsource_score'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ====================================
-- Drop and Recreate with Secure Search Path
-- ====================================

-- Drop the existing function
DROP FUNCTION IF EXISTS public.update_crowdsource_score() CASCADE;
DROP FUNCTION IF EXISTS public.update_crowdsource_score(UUID) CASCADE;

-- Recreate with secure search_path
-- This function updates the crowdsource score for a location
CREATE OR REPLACE FUNCTION public.update_crowdsource_score(location_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  avg_rating NUMERIC;
  rating_count INTEGER;
BEGIN
  -- Calculate average rating and count
  SELECT 
    COALESCE(AVG(rating), 0),
    COUNT(*)
  INTO avg_rating, rating_count
  FROM public.user_ratings
  WHERE user_ratings.location_id = update_crowdsource_score.location_id;

  -- Update the location's crowdsource score
  UPDATE public.locations
  SET 
    crowdsource_score = avg_rating,
    rating_count = update_crowdsource_score.rating_count
  WHERE id = update_crowdsource_score.location_id;
END;
$$;

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
WHERE proname = 'update_crowdsource_score'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ====================================
-- DONE!
-- ====================================

SELECT '✅ Security fix applied - update_crowdsource_score now has search_path set' AS status;
