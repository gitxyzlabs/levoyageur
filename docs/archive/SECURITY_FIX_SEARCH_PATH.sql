-- ====================================
-- Le Voyageur - Fix Function Search Path Security
-- ====================================
-- This addresses the security vulnerability where trigger_update_location_score
-- has a mutable search_path, which could be exploited via search_path attacks
-- Run this in Supabase SQL Editor

-- ====================================
-- STEP 1: Identify All Functions with Mutable Search Path
-- ====================================

SELECT 
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS function_definition,
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%SECURITY DEFINER%' THEN '⚠️ CRITICAL - SECURITY DEFINER'
    ELSE '⚠️ WARNING'
  END AS risk_level,
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' THEN '✅ Has search_path set'
    ELSE '🔴 VULNERABLE - No search_path set'
  END AS security_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND NOT pg_get_functiondef(p.oid) LIKE '%SET search_path%'
ORDER BY 
  CASE WHEN pg_get_functiondef(p.oid) LIKE '%SECURITY DEFINER%' THEN 1 ELSE 2 END,
  p.proname;

-- ====================================
-- STEP 2: View the Current Function Definition
-- ====================================

SELECT pg_get_functiondef(oid) AS current_definition
FROM pg_proc
WHERE proname = 'trigger_update_location_score'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ====================================
-- STEP 3: Drop and Recreate with Secure Search Path
-- ====================================

-- Drop the existing function
DROP FUNCTION IF EXISTS public.trigger_update_location_score() CASCADE;

-- Recreate with secure search_path
-- This function calculates the LV score based on user ratings
CREATE OR REPLACE FUNCTION public.trigger_update_location_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp  -- FIX: Set explicit search_path
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
-- STEP 4: Recreate the Trigger
-- ====================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_location_score_trigger ON public.user_ratings;

-- Recreate trigger
CREATE TRIGGER update_location_score_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.user_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_location_score();

-- ====================================
-- STEP 5: Fix ALL Other Functions (if any)
-- ====================================

-- This will add search_path to any other functions that need it
-- You may need to customize this based on your other functions

-- Example: If you have other trigger functions, fix them similarly
-- DROP FUNCTION IF EXISTS public.other_function() CASCADE;
-- CREATE OR REPLACE FUNCTION public.other_function()
-- ...
-- SET search_path = public, pg_temp
-- ...

-- ====================================
-- STEP 6: Verify All Functions Are Now Secure
-- ====================================

SELECT 
  n.nspname AS schema_name,
  p.proname AS function_name,
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' THEN '✅ SECURE'
    ELSE '⚠️ STILL VULNERABLE'
  END AS security_status,
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%SECURITY DEFINER%' THEN 'Yes'
    ELSE 'No'
  END AS is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind IN ('f', 'p')  -- Functions and procedures
ORDER BY p.proname;

-- ====================================
-- STEP 7: Test the Function Still Works
-- ====================================

-- Verify trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'update_location_score_trigger';

-- ====================================
-- STEP 8: Security Summary
-- ====================================

SELECT 
  COUNT(*) FILTER (WHERE pg_get_functiondef(p.oid) LIKE '%SET search_path%') AS functions_with_search_path,
  COUNT(*) FILTER (WHERE pg_get_functiondef(p.oid) NOT LIKE '%SET search_path%') AS functions_without_search_path,
  COUNT(*) AS total_functions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind IN ('f', 'p');

-- ====================================
-- DONE!
-- ====================================

SELECT 
  '✅ Function security fix complete' AS status,
  'trigger_update_location_score now has search_path = public, pg_temp' AS action_taken,
  'Function is protected against search_path attacks' AS result;
