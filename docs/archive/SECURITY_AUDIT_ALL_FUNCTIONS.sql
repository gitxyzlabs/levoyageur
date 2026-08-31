-- ====================================
-- Le Voyageur - Audit ALL Functions for Search Path Vulnerability
-- ====================================
-- This identifies ALL functions that still need the search_path fix

-- ====================================
-- Find ALL Functions Without search_path Set
-- ====================================

SELECT 
  p.proname AS function_name,
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%SECURITY DEFINER%' THEN '🔴 CRITICAL - Security Definer'
    ELSE '⚠️ WARNING'
  END AS risk_level,
  pg_get_function_identity_arguments(p.oid) AS function_signature
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind IN ('f', 'p')  -- Functions and procedures
  AND NOT pg_get_functiondef(p.oid) LIKE '%SET search_path%'
  AND p.proname NOT LIKE 'pg_%'  -- Exclude PostgreSQL internal functions
ORDER BY 
  CASE WHEN pg_get_functiondef(p.oid) LIKE '%SECURITY DEFINER%' THEN 1 ELSE 2 END,
  p.proname;

-- ====================================
-- Count Vulnerable vs Secure Functions
-- ====================================

SELECT 
  COUNT(*) FILTER (
    WHERE pg_get_functiondef(p.oid) LIKE '%SET search_path%'
  ) AS secure_functions,
  COUNT(*) FILTER (
    WHERE NOT pg_get_functiondef(p.oid) LIKE '%SET search_path%'
  ) AS vulnerable_functions,
  COUNT(*) AS total_functions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind IN ('f', 'p')
  AND p.proname NOT LIKE 'pg_%';

-- ====================================
-- Show All Secure Functions (Verified)
-- ====================================

SELECT 
  p.proname AS function_name,
  '✅ SECURE' AS status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind IN ('f', 'p')
  AND pg_get_functiondef(p.oid) LIKE '%SET search_path%'
  AND p.proname NOT LIKE 'pg_%'
ORDER BY p.proname;
